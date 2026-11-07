// Buffer is the global installed by react-native-quick-crypto install() (root _layout.tsx).
import { randomBytes } from "react-native-quick-crypto";

import { ImageDecryptError, decryptBytes, encryptBytes } from "@/images/crypto";

import {
  ArchiveFormatError,
  ArchiveIncompleteError,
  ArchiveVersionError,
  WrongPassphraseError,
} from "./errors";
import { DEFAULT_KDF, type KdfParams, MIN_PASSPHRASE, SCRYPT_MAXMEM, deriveArchiveKey, passphraseLength } from "./kdf";

export interface ByteSink {
  write(b: Uint8Array): Promise<void>;
  close(): Promise<void>;
}
export interface ByteSource {
  /** Returns fewer than n bytes only at EOF. */
  read(n: number): Promise<Uint8Array>;
  close(): Promise<void>;
}

export type ArchiveHeader = { format: 1; encrypted: boolean; kdf?: KdfParams };

export interface ArchiveWriter {
  manifest(m: object): Promise<void>;
  snapshot(json: object): Promise<void>;
  page(name: string, bytes: Uint8Array): Promise<void>;
  finish(): Promise<void>;
}
export interface ArchiveReader {
  manifest(): Promise<object>;
  snapshot(): Promise<object>;
  pages(): AsyncIterable<{ name: string; bytes: Uint8Array }>;
}

const MAGIC = "MEBA";
const FORMAT = 1;
const MAX_HEADER = 64 * 1024;
const MAX_RECORD = 64 * 1024 * 1024;
const T_MANIFEST = 1;
const T_SNAPSHOT = 2;
const T_PAGE = 3;
const PAGE_NAME_RE = /^[A-Za-z0-9-]+\.enc$/;
const SALT_RE = /^[0-9a-f]{32}$/;
const MIN_ENCRYPTED = 32; // "MEB1" + 12-byte IV + 16-byte tag

const u32 = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
};
const concat = (...parts: Uint8Array[]) => new Uint8Array(Buffer.concat(parts));
const utf8 = (s: string) => new Uint8Array(Buffer.from(s, "utf8"));
const text = (b: Uint8Array) => Buffer.from(b).toString("utf8");

function assertManifest(m: unknown): asserts m is { pageNames: string[]; schemaVersion: number } {
  if (typeof m !== "object" || m === null) throw new ArchiveFormatError("manifest is not an object");
  const o = m as Record<string, unknown>;
  if (typeof o.schemaVersion !== "number") throw new ArchiveFormatError("manifest schemaVersion");
  if (!Array.isArray(o.pageNames) || !o.pageNames.every((n) => typeof n === "string")) {
    throw new ArchiveFormatError("manifest pageNames");
  }
  for (const n of o.pageNames as string[]) {
    if (!PAGE_NAME_RE.test(n)) throw new ArchiveFormatError("invalid page name");
  }
}

// Close ownership: the writer's finish() closes the sink on success only; the caller owns
// sink.close() on error paths. The reader never closes the source; the caller always does.
export async function createArchiveWriter(
  sink: ByteSink,
  opts: { passphrase: string | null },
): Promise<ArchiveWriter> {
  let key: Uint8Array | null = null;
  let header: ArchiveHeader;
  if (opts.passphrase === null) {
    header = { format: FORMAT, encrypted: false };
  } else {
    if (passphraseLength(opts.passphrase) < MIN_PASSPHRASE) {
      throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE} characters`);
    }
    const kdf: KdfParams = {
      name: "scrypt",
      ...DEFAULT_KDF,
      salt: Buffer.from(randomBytes(16)).toString("hex"),
    };
    key = await deriveArchiveKey(opts.passphrase, kdf);
    header = { format: FORMAT, encrypted: true, kdf };
  }
  const headerBytes = utf8(JSON.stringify(header));
  await sink.write(concat(utf8(MAGIC), new Uint8Array([FORMAT]), u32(headerBytes.length), headerBytes));

  let snapshotWritten = false;
  let stage: "manifest" | "snapshot" | "pages" | "done" = "manifest";
  let listed: Set<string> = new Set();
  const written = new Set<string>();

  const record = async (type: number, plain: Uint8Array) => {
    const payload = key ? encryptBytes(key, plain) : plain;
    if (payload.length > MAX_RECORD) throw new Error("Record too large");
    await sink.write(concat(new Uint8Array([type]), u32(payload.length), payload));
  };

  return {
    async manifest(m) {
      if (stage !== "manifest") throw new Error("manifest must be written first, once");
      assertManifest(m);
      listed = new Set(m.pageNames);
      await record(T_MANIFEST, utf8(JSON.stringify(m)));
      stage = "snapshot";
    },
    async snapshot(json) {
      if (stage !== "snapshot") throw new Error("snapshot must follow the manifest, once");
      await record(T_SNAPSHOT, utf8(JSON.stringify(json)));
      stage = "pages";
      snapshotWritten = true;
    },
    async page(name, bytes) {
      if (stage !== "pages") throw new Error("pages must follow the snapshot");
      if (!PAGE_NAME_RE.test(name)) throw new ArchiveFormatError("invalid page name");
      if (!listed.has(name)) throw new Error("page not listed in manifest");
      if (written.has(name)) throw new Error("duplicate page");
      const nameBytes = utf8(name);
      const nl = new Uint8Array(2);
      new DataView(nl.buffer).setUint16(0, nameBytes.length);
      await record(T_PAGE, concat(nl, nameBytes, bytes));
      written.add(name);
    },
    async finish() {
      if (stage === "done") return;
      if (stage === "manifest" || !snapshotWritten) throw new Error("manifest and snapshot are required");
      if (written.size !== listed.size) throw new Error("not every manifest page was written");
      stage = "done";
      await sink.close();
    },
  };
}

export async function openArchive(
  source: ByteSource,
): Promise<{ header: ArchiveHeader; unlock(passphrase: string | null): Promise<ArchiveReader> }> {
  const readExact = async (n: number, what: string) => {
    const b = await source.read(n);
    if (b.length !== n) throw new ArchiveFormatError(`truncated ${what}`);
    return b;
  };

  const head = await readExact(9, "preamble");
  if (text(head.slice(0, 4)) !== MAGIC) throw new ArchiveFormatError("bad magic");
  if (head[4] > FORMAT) throw new ArchiveVersionError(`container version ${head[4]}`);
  if (head[4] !== FORMAT) throw new ArchiveFormatError("bad container version");
  const headerLen = new DataView(head.buffer, head.byteOffset, 9).getUint32(5);
  if (headerLen > MAX_HEADER) throw new ArchiveFormatError("header too large");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text(await readExact(headerLen, "header")));
  } catch (e) {
    if (e instanceof ArchiveFormatError) throw e;
    throw new ArchiveFormatError("header is not JSON");
  }
  const header = parseHeader(parsed);

  type Rec = { type: number; plain: Uint8Array };
  // Reads one record; returns null at clean EOF on a record boundary.
  const nextRecord = async (): Promise<{ type: number; plain: Uint8Array } | null> => {
    const t = await source.read(1);
    if (t.length === 0) return null;
    const lenB = await readExact(4, "record length");
    const len = new DataView(lenB.buffer, lenB.byteOffset, 4).getUint32(0);
    if (len > MAX_RECORD) throw new ArchiveFormatError("record too large");
    const payload = await readExact(len, "record");
    return { type: t[0], plain: payload };
  };
  // The first record is read once and cached so a failed unlock can be retried.
  let firstRecord: Promise<Rec | null> | null = null;

  async function unlock(passphrase: string | null): Promise<ArchiveReader> {
    let key: Uint8Array | null = null;
    if (header.encrypted) {
      if (passphrase === null || !header.kdf) throw new WrongPassphraseError();
      key = await deriveArchiveKey(passphrase, header.kdf);
    }

    const open = (payload: Uint8Array, first: boolean): Uint8Array => {
      if (!key) return payload;
      if (payload.length < MIN_ENCRYPTED) throw new ArchiveFormatError("record too short");
      if (text(payload.slice(0, 4)) !== "MEB1") throw new ArchiveFormatError("record is not encrypted");
      try {
        return decryptBytes(key, payload);
      } catch (e) {
        if (e instanceof ImageDecryptError) {
          if (first) throw new WrongPassphraseError();
          throw new ArchiveFormatError("record failed authentication");
        }
        throw e;
      }
    };
    const parseJson = (b: Uint8Array, what: string): object => {
      try {
        const v: unknown = JSON.parse(text(b));
        if (typeof v !== "object" || v === null) throw new Error("not object");
        return v;
      } catch {
        throw new ArchiveFormatError(`${what} is not JSON`);
      }
    };

    firstRecord ??= nextRecord();
    const first = await firstRecord;
    if (!first || first.type !== T_MANIFEST) throw new ArchiveFormatError("missing manifest");
    const manifest = parseJson(open(first.plain, true), "manifest");
    assertManifest(manifest);
    const pageNames = new Set(manifest.pageNames);

    let snapshot: object | null = null;
    const loadSnapshot = async () => {
      if (snapshot) return snapshot;
      const rec = await nextRecord();
      if (!rec || rec.type !== T_SNAPSHOT) throw new ArchiveFormatError("missing snapshot");
      snapshot = parseJson(open(rec.plain, false), "snapshot");
      return snapshot;
    };

    let pagesStarted = false;
    return {
      async manifest() {
        return manifest;
      },
      snapshot: loadSnapshot,
      pages() {
        return {
          [Symbol.asyncIterator]: async function* () {
            if (pagesStarted) throw new Error("pages() can only be read once");
            pagesStarted = true;
            await loadSnapshot();
            const seen = new Set<string>();
            for (;;) {
              const rec = await nextRecord();
              if (!rec) break;
              if (rec.type !== T_PAGE) throw new ArchiveFormatError("unexpected record type");
              const plain = open(rec.plain, false);
              if (plain.length < 2) throw new ArchiveFormatError("page too short");
              const nl = new DataView(plain.buffer, plain.byteOffset, plain.length).getUint16(0);
              if (plain.length < 2 + nl) throw new ArchiveFormatError("page name truncated");
              const name = text(plain.slice(2, 2 + nl));
              if (!PAGE_NAME_RE.test(name)) throw new ArchiveFormatError("invalid page name");
              if (!pageNames.has(name)) throw new ArchiveFormatError("page not listed in manifest");
              if (seen.has(name)) throw new ArchiveFormatError("duplicate page");
              seen.add(name);
              yield { name, bytes: plain.slice(2 + nl) };
            }
            const missing = manifest.pageNames.filter((n) => !seen.has(n));
            if (missing.length > 0) throw new ArchiveIncompleteError(missing);
          },
        };
      },
    };
  }

  return { header, unlock };
}

function parseHeader(v: unknown): ArchiveHeader {
  if (typeof v !== "object" || v === null) throw new ArchiveFormatError("header");
  const h = v as Record<string, unknown>;
  if (typeof h.format !== "number") throw new ArchiveFormatError("header format");
  if (h.format > FORMAT) throw new ArchiveVersionError(`format ${h.format}`);
  if (h.format !== FORMAT) throw new ArchiveFormatError("header format");
  if (typeof h.encrypted !== "boolean") throw new ArchiveFormatError("header encrypted");
  if (!h.encrypted) return { format: FORMAT, encrypted: false };
  const k = h.kdf as Record<string, unknown> | undefined;
  if (
    !k ||
    k.name !== "scrypt" ||
    typeof k.salt !== "string" ||
    !SALT_RE.test(k.salt) ||
    !Number.isInteger(k.N) ||
    !Number.isInteger(k.r) ||
    !Number.isInteger(k.p)
  ) {
    throw new ArchiveFormatError("header kdf");
  }
  const { N, r, p } = k as { N: number; r: number; p: number };
  // Reject params that are not a power of two or would exceed the scrypt memory cap.
  if (N < 2 || (N & (N - 1)) !== 0 || r < 1 || p < 1 || p > 16 || 128 * N * r >= SCRYPT_MAXMEM) {
    throw new ArchiveFormatError("header kdf parameters");
  }
  return { format: FORMAT, encrypted: true, kdf: { name: "scrypt", N, r, p, salt: k.salt } };
}
