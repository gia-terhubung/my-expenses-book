import {
  ArchiveFormatError,
  ArchiveIncompleteError,
  ArchiveVersionError,
  WrongPassphraseError,
} from "./errors";
import { type ByteSink, type ByteSource, createArchiveWriter, openArchive } from "./container";

// Fast KDF params for tests are not injectable; default N=32768 is ~100 ms per derivation.
const PASS = "p\u00e4ssw\u00f6rd";
const NFD = PASS.normalize("NFD");

function memSink() {
  const chunks: Uint8Array[] = [];
  let closed = false;
  const sink: ByteSink = {
    async write(b) {
      chunks.push(new Uint8Array(b));
    },
    async close() {
      closed = true;
    },
  };
  return {
    sink,
    isClosed: () => closed,
    bytes: () => new Uint8Array(Buffer.concat(chunks)),
  };
}

function memSource(data: Uint8Array): ByteSource & { closed: boolean } {
  let pos = 0;
  const src = {
    closed: false,
    async read(n: number) {
      const out = data.slice(pos, pos + n);
      pos += out.length;
      return out;
    },
    async close() {
      src.closed = true;
    },
  };
  return src;
}

const manifest = (pageNames: string[]) => ({
  createdAt: "2026-01-01T00:00:00Z",
  appVersion: "1.0.0",
  schemaVersion: 3,
  pageNames,
  counts: { receipts: 3 },
  secretMarker: "UNIQUE-MANIFEST-TEXT",
});
const NAMES = ["a-1.enc", "b-2.enc", "c-3.enc"];
const pagesData = NAMES.map((n, i) => ({ name: n, bytes: new Uint8Array([i, i + 1, 255, 0, 7]) }));

async function build(passphrase: string | null, names = NAMES, pages = pagesData) {
  const m = memSink();
  const w = await createArchiveWriter(m.sink, { passphrase });
  await w.manifest(manifest(names));
  await w.snapshot({ rows: [{ id: "r1" }] });
  for (const p of pages) await w.page(p.name, p.bytes);
  await w.finish();
  return m;
}

async function readAll(bytes: Uint8Array, passphrase: string | null) {
  const a = await openArchive(memSource(bytes));
  const r = await a.unlock(passphrase);
  const pages: { name: string; bytes: Uint8Array }[] = [];
  for await (const p of r.pages()) pages.push(p);
  return { header: a.header, m: await r.manifest(), s: await r.snapshot(), pages };
}

describe("archive round-trip", () => {
  it.each([
    ["encrypted", PASS],
    ["unencrypted", null],
  ])("%s", async (_n, pass) => {
    const m = await build(pass);
    expect(m.isClosed()).toBe(true);
    const out = await readAll(m.bytes(), pass);
    expect(out.m).toEqual(manifest(NAMES));
    expect(out.s).toEqual({ rows: [{ id: "r1" }] });
    expect(out.pages.map((p) => p.name)).toEqual(NAMES);
    out.pages.forEach((p, i) => expect(Array.from(p.bytes)).toEqual(Array.from(pagesData[i].bytes)));
  });

  it("header: unencrypted has no kdf; encrypted carries 32-hex salt and params", async () => {
    const u = await build(null);
    const hu = (await openArchive(memSource(u.bytes()))).header;
    expect(hu).toEqual({ format: 1, encrypted: false });
    const e = await build(PASS);
    const he = (await openArchive(memSource(e.bytes()))).header;
    expect(he.encrypted).toBe(true);
    expect(he.kdf).toMatchObject({ name: "scrypt", N: 32768, r: 8, p: 1 });
    expect(he.kdf?.salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it("unencrypted file shows manifest text; encrypted does not", async () => {
    const needle = Buffer.from("UNIQUE-MANIFEST-TEXT");
    expect(Buffer.from((await build(null)).bytes()).includes(needle)).toBe(true);
    expect(Buffer.from((await build(PASS)).bytes()).includes(needle)).toBe(false);
  });

  it("passphrase in NFD unlocks archive written with NFC", async () => {
    const m = await build(PASS);
    expect(NFD).not.toBe(PASS);
    expect((await readAll(m.bytes(), NFD)).pages).toHaveLength(3);
  });

  it("unencrypted ignores passphrase", async () => {
    const m = await build(null);
    expect((await readAll(m.bytes(), "whatever")).pages).toHaveLength(3);
  });
});

describe("passphrase errors", () => {
  it("wrong passphrase", async () => {
    const m = await build(PASS);
    const a = await openArchive(memSource(m.bytes()));
    await expect(a.unlock("wrong-passphrase")).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it("null passphrase on encrypted", async () => {
    const m = await build(PASS);
    const a = await openArchive(memSource(m.bytes()));
    await expect(a.unlock(null)).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it("writer rejects short passphrase", async () => {
    await expect(createArchiveWriter(memSink().sink, { passphrase: "short" })).rejects.toThrow();
    await expect(createArchiveWriter(memSink().sink, { passphrase: "1234567" })).rejects.toThrow();
  });
});

describe("malformed input", () => {
  it("PDF header", async () => {
    await expect(openArchive(memSource(Buffer.from("%PDF-1.7 blah blah")))).rejects.toBeInstanceOf(
      ArchiveFormatError,
    );
  });

  it("empty source", async () => {
    await expect(openArchive(memSource(new Uint8Array(0)))).rejects.toBeInstanceOf(ArchiveFormatError);
  });

  it("cut mid-page", async () => {
    const b = (await build(null)).bytes();
    const cut = b.slice(0, b.length - 3);
    const a = await openArchive(memSource(cut));
    const r = await a.unlock(null);
    await expect(
      (async () => {
        for await (const p of r.pages()) void p;
      })(),
    ).rejects.toBeInstanceOf(ArchiveFormatError);
  });

  it("flipped byte in page 2 ciphertext", async () => {
    const b = (await build(PASS)).bytes();
    // Locate page 2 by walking records.
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let off = 5 + 4 + dv.getUint32(5);
    const starts: number[] = [];
    while (off < b.length) {
      starts.push(off);
      off += 5 + dv.getUint32(off + 1);
    }
    const bad = new Uint8Array(b);
    bad[starts[3] + 5 + 20] ^= 0xff; // records: manifest, snapshot, page1, page2
    const a = await openArchive(memSource(bad));
    const r = await a.unlock(PASS);
    await expect(
      (async () => {
        for await (const p of r.pages()) void p;
      })(),
    ).rejects.toBeInstanceOf(ArchiveFormatError);
  });

  it("header format 2 -> ArchiveVersionError", async () => {
    const b = Buffer.from((await build(null)).bytes());
    const hl = b.readUInt32BE(5);
    const hdr = JSON.stringify({ format: 2, encrypted: false });
    expect(Buffer.byteLength(hdr)).toBe(hl); // same length as '{"format":1,...}'
    Buffer.from(hdr).copy(b, 9);
    await expect(openArchive(memSource(new Uint8Array(b)))).rejects.toBeInstanceOf(ArchiveVersionError);
  });

  it("bad header JSON and oversized header", async () => {
    const mk = (h: Buffer) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(h.length);
      return new Uint8Array(Buffer.concat([Buffer.from("MEBA"), Buffer.from([1]), len, h]));
    };
    await expect(openArchive(memSource(mk(Buffer.from("{nope"))))).rejects.toBeInstanceOf(
      ArchiveFormatError,
    );
    const big = Buffer.alloc(64 * 1024 + 1, 0x20);
    await expect(openArchive(memSource(mk(big)))).rejects.toBeInstanceOf(ArchiveFormatError);
  });

  it("manifest lists 3 pages, archive holds 2", async () => {
    const m = await build(null, NAMES, pagesData.slice(0, 2));
    await expect(readAll(m.bytes(), null)).rejects.toBeInstanceOf(ArchiveIncompleteError);
  });

  it("duplicate page and unlisted page -> format error (reader)", async () => {
    // Writer enforces listing, so craft by building two manifests worth of bytes.
    const m = memSink();
    const w = await createArchiveWriter(m.sink, { passphrase: null });
    await w.manifest(manifest(["a-1.enc", "b-2.enc"]));
    await w.snapshot({});
    await w.page("a-1.enc", new Uint8Array([1]));
    await w.page("b-2.enc", new Uint8Array([2]));
    await w.finish();
    const good = m.bytes();
    // Rename page 2's name in place: "b-2.enc" -> "a-1.enc" (duplicate) / "z-9.enc" (unlisted).
    const patch = (to: string) => {
      const buf = Buffer.from(good);
      const i = buf.lastIndexOf(Buffer.from("b-2.enc"));
      Buffer.from(to).copy(buf, i);
      return new Uint8Array(buf);
    };
    await expect(readAll(patch("a-1.enc"), null)).rejects.toBeInstanceOf(ArchiveFormatError);
    await expect(readAll(patch("z-9.enc"), null)).rejects.toBeInstanceOf(ArchiveFormatError);
  });

  it("unknown record type", async () => {
    const b = Buffer.from((await build(null)).bytes());
    const off = 9 + b.readUInt32BE(5);
    b[off] = 9;
    await expect(readAll(new Uint8Array(b), null)).rejects.toBeInstanceOf(ArchiveFormatError);
  });

  it("record length over 64 MiB", async () => {
    const b = Buffer.from((await build(null)).bytes());
    const off = 9 + b.readUInt32BE(5);
    b.writeUInt32BE(64 * 1024 * 1024 + 1, off + 1);
    await expect(readAll(new Uint8Array(b), null)).rejects.toBeInstanceOf(ArchiveFormatError);
  });

  it("manifest missing pageNames / schemaVersion", async () => {
    const m1 = memSink();
    const w1 = await createArchiveWriter(m1.sink, { passphrase: null });
    await expect(w1.manifest({ schemaVersion: 1 })).rejects.toThrow();
    // Reader side: craft manifest record by patching text.
    const good = Buffer.from((await build(null)).bytes());
    const bad = Buffer.from(good.toString("latin1").replace('"pageNames"', '"pageNamez"'), "latin1");
    await expect(readAll(new Uint8Array(bad), null)).rejects.toBeInstanceOf(ArchiveFormatError);
  });
});

describe("writer misuse", () => {
  it("enforces order manifest -> snapshot -> pages", async () => {
    const w = await createArchiveWriter(memSink().sink, { passphrase: null });
    await expect(w.snapshot({})).rejects.toThrow();
    await expect(w.page("a-1.enc", new Uint8Array(1))).rejects.toThrow();
    await w.manifest(manifest(["a-1.enc"]));
    await expect(w.manifest(manifest([]))).rejects.toThrow();
    await expect(w.page("a-1.enc", new Uint8Array(1))).rejects.toThrow();
    await w.snapshot({});
    await expect(w.snapshot({})).rejects.toThrow();
    await w.page("a-1.enc", new Uint8Array(1));
    await expect(w.page("a-1.enc", new Uint8Array(1))).rejects.toThrow(); // duplicate
    await expect(w.page("zz.enc", new Uint8Array(1))).rejects.toThrow(); // unlisted
  });

  it("rejects bad page names", async () => {
    const w = await createArchiveWriter(memSink().sink, { passphrase: null });
    await expect(w.manifest(manifest(["../x.enc"]))).rejects.toBeInstanceOf(ArchiveFormatError);
    await expect(w.manifest(manifest(["x.png"]))).rejects.toBeInstanceOf(ArchiveFormatError);
  });
});
