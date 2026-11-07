import { ZodError } from "zod";

import { notifyDataChanged } from "@/db/changes";
import { listAllPagePaths, listPages } from "@/db/repositories/pages";
import { getReceipt } from "@/db/repositories/receipts";
import type { AppDb } from "@/db/types";
import { findDuplicates } from "@/capture/duplicates";
import { reconvertAll } from "@/fx/reconvert";
import type { ImageStore } from "@/images/store";
import type { PrefsStore } from "@/prefs/prefs";

import { type MergeResult, type RestoreMode, applyMerge, applyReplace } from "./applySnapshot";
import { type ByteSource, openArchive } from "./container";
import { ArchiveFormatError, ArchiveVersionError } from "./errors";
import { SCHEMA_VERSION, type Snapshot, snapshotSchema } from "./snapshot";

export type { MergeResult, RestoreMode } from "./applySnapshot";

export type PossibleDuplicate = { receiptId: string; matchId: string };

const PAGES_PREFIX = "pages/";

function devWarn(msg: string, e: unknown): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) console.warn(msg, e);
}

/** Runs a post-commit step; a failure is logged and swallowed (the import is already committed). */
function afterCommit(name: string, step: () => void): void {
  try {
    step();
  } catch (e) {
    devWarn(`restore: ${name} failed`, e);
  }
}

function parseSnapshot(raw: object): Snapshot {
  try {
    return snapshotSchema.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) throw new ArchiveFormatError("snapshot does not match the schema");
    throw e;
  }
}

/**
 * Restores a `.meb` archive. Data safety: steps 1-5 (read, validate, write new page files, one DB
 * transaction) either all succeed or leave existing rows and page files exactly as they were (new
 * page files are deleted, the transaction rolls back). Post-commit steps can no longer undo the
 * import; their failures are logged and ignored. The source is always closed.
 *
 * `result` counts receipts only (see MergeResult); for replace every snapshot receipt is
 * "inserted". `possibleDuplicates` is computed for merge only.
 */
export async function importBackup(deps: {
  db: AppDb;
  prefs: PrefsStore;
  store: ImageStore;
  source: ByteSource;
  passphrase: string | null;
  mode: RestoreMode;
  onProgress?: (done: number, total: number) => void;
}): Promise<{ result: MergeResult; possibleDuplicates: PossibleDuplicate[] }> {
  const { db, prefs, store, source, passphrase, mode, onProgress } = deps;
  const newPaths: string[] = [];
  let result: MergeResult;
  let snap: Snapshot;
  try {
    try {
      // 1. Open, unlock, version gate.
      const reader = await (await openArchive(source)).unlock(passphrase);
      const manifest = (await reader.manifest()) as { schemaVersion: number; pageNames: string[] };
      if (manifest.schemaVersion > SCHEMA_VERSION) {
        throw new ArchiveVersionError(`schema ${manifest.schemaVersion} > ${SCHEMA_VERSION}`);
      }
      // 2. Validate the snapshot before anything is written.
      snap = parseSnapshot(await reader.snapshot());
      if (snap.schemaVersion > SCHEMA_VERSION) {
        throw new ArchiveVersionError(`snapshot schema ${snap.schemaVersion} > ${SCHEMA_VERSION}`);
      }
      // 3. Every page into the store first: the reader only reports a missing or corrupt page at
      // the end of the stream, so the DB is touched only after the whole archive checked out.
      const total = manifest.pageNames.length;
      const pathByName = new Map<string, string>();
      onProgress?.(0, total);
      for await (const page of reader.pages()) {
        const path = await store.importPage(page.bytes);
        newPaths.push(path);
        pathByName.set(page.name, path);
        onProgress?.(pathByName.size, total);
      }
      // 4. Point page rows at the new files. A path with no page record (soft-deleted page, or
      // file missing at backup time) keeps its value and shows as "image unavailable".
      const remap = (p: string) =>
        p.startsWith(PAGES_PREFIX) ? (pathByName.get(p.slice(PAGES_PREFIX.length)) ?? p) : p;
      snap = {
        ...snap,
        receiptPages: snap.receiptPages.map((p) => ({
          ...p,
          imagePath: remap(p.imagePath),
          thumbPath: p.thumbPath === null ? null : remap(p.thumbPath),
        })),
      };
      // 5. One transaction.
      if (mode === "replace") {
        applyReplace(db, snap);
        result = { inserted: snap.receipts.length, updated: 0, kept: 0, insertedReceiptIds: snap.receipts.map((r) => r.id) };
      } else {
        result = applyMerge(db, snap);
      }
    } catch (e) {
      // 6. Undo the only side effect so far: the new page files.
      if (newPaths.length > 0) {
        await store.deleteFiles(newPaths).catch((err: unknown) => devWarn("restore: deleting new pages failed", err));
      }
      throw e;
    }
  } finally {
    await source.close().catch(() => undefined);
  }

  // 7. Committed. Nothing below may roll the import back.
  try {
    await store.cleanupOrphanPages(listAllPagePaths(db)); // replaced / losing files
  } catch (e) {
    devWarn("restore: cleanupOrphanPages failed", e);
  }
  if (mode === "replace") {
    afterCommit("prefs", () => {
      // C5: home currency and tax year come from the archive; lock settings and language never.
      if (snap.prefs.homeCurrency) prefs.set("homeCurrency", snap.prefs.homeCurrency);
      const m = snap.prefs.taxYearStartMonth;
      if (m >= 1 && m <= 12) prefs.set("taxYearStartMonth", m);
    });
  }
  afterCommit("reconvert", () => {
    const home = prefs.get("homeCurrency");
    if (home) reconvertAll(db, home, prefs.get("fxTables"));
  });
  const possibleDuplicates: PossibleDuplicate[] = [];
  if (mode === "merge") {
    afterCommit("duplicates", () => {
      const inserted = new Set(result.insertedReceiptIds);
      for (const id of result.insertedReceiptIds) {
        const r = getReceipt(db, id); // null when soft-deleted
        if (!r || r.status !== "confirmed") continue;
        const hashes = listPages(db, id).flatMap((p) => (p.dhash ? [p.dhash] : []));
        for (const m of findDuplicates(db, r, hashes)) {
          if (!inserted.has(m.receiptId)) possibleDuplicates.push({ receiptId: id, matchId: m.receiptId });
        }
      }
    });
  }
  notifyDataChanged();
  return { result, possibleDuplicates };
}
