import { createFolder } from "@/db/repositories/folders";
import { createPage } from "@/db/repositories/pages";
import { sumHome } from "@/db/repositories/receiptQueries";
import { createReceipt } from "@/db/repositories/receipts";
import { categories, folders, lineItems, receiptPages, receipts } from "@/db/schema";
import { testDb } from "@/db/testing/testDb";
import type { AppDb, NewReceiptInput } from "@/db/types";
import type { ImageStore } from "@/images/store";
import { createPrefs, type KV, type PrefsStore } from "@/prefs/prefs";

import { type ByteSink, createArchiveWriter } from "./container";
import { ArchiveFormatError, ArchiveVersionError, WrongPassphraseError } from "./errors";
import { exportBackup } from "./exportBackup";
import { importBackup } from "./importBackup";
import { SCHEMA_VERSION, collectSnapshot, type Snapshot } from "./snapshot";

const PASS = "correct horse";

function memSink() {
  const chunks: Uint8Array[] = [];
  const sink: ByteSink = {
    async write(b) {
      chunks.push(new Uint8Array(b));
    },
    async close() {},
  };
  return { sink, bytes: () => new Uint8Array(Buffer.concat(chunks)) };
}

function source(data: Uint8Array) {
  let pos = 0;
  let closed = false;
  return {
    async read(n: number) {
      const out = data.slice(pos, pos + n);
      pos += out.length;
      return out;
    },
    async close() {
      closed = true;
    },
    isClosed: () => closed,
  };
}

function prefs(home: string | null = "IDR", taxMonth = 1): PrefsStore {
  const m = new Map<string, string>();
  const kv: KV = { getString: (k) => m.get(k), set: (k, v) => void m.set(k, v), delete: (k) => void m.delete(k) };
  const p = createPrefs(kv);
  if (home) p.set("homeCurrency", home);
  p.set("taxYearStartMonth", taxMonth);
  return p;
}

/** Plain bytes keyed by relative path; mirrors the real store's contract. */
function fakeStore(files = new Map<string, Uint8Array>(), opts: { failImportAt?: number; failCleanup?: boolean } = {}) {
  let n = 0;
  const imported: string[] = [];
  const store = {
    exists: async (p: string) => files.has(p),
    readPlain: async (p: string) => {
      const b = files.get(p);
      if (!b) throw new Error("ENOENT");
      return b;
    },
    importPage: async (plain: Uint8Array) => {
      n++;
      if (opts.failImportAt === n) throw new Error("disk full");
      const p = `pages/imp-${n}-${Math.random().toString(16).slice(2)}.enc`;
      files.set(p, new Uint8Array(plain));
      imported.push(p);
      return p;
    },
    deleteFiles: async (paths: string[]) => {
      for (const p of paths) files.delete(p);
    },
    cleanupOrphanPages: async (known: string[]) => {
      if (opts.failCleanup) throw new Error("cleanup failed");
      const k = new Set(known);
      let removed = 0;
      for (const p of [...files.keys()]) {
        if (!k.has(p)) {
          files.delete(p);
          removed++;
        }
      }
      return removed;
    },
  } as unknown as ImageStore;
  return { store, files, imported };
}

const P = (n: string) => `pages/${n}.enc`;

function addReceipt(db: AppDb, over: Partial<NewReceiptInput> = {}) {
  return createReceipt(db, {
    merchant: "Toko Maju",
    purchasedAtLocal: "2026-03-01T10:00:00",
    purchasedAtUtc: 1772334000000,
    scannedAtUtc: 1772334060000,
    currency: "IDR",
    totalMinor: 12500,
    // Already converted for IDR so reconvertAll leaves the row untouched.
    fxRate: "1",
    fxRateDate: "2026-03-01",
    homeCurrencyAtSave: "IDR",
    amountHomeMinor: 12500,
    parseSource: "manual",
    status: "confirmed",
    ...over,
  });
}

function rows(db: AppDb) {
  return {
    categories: db.select().from(categories).all(),
    folders: db.select().from(folders).all(),
    receipts: db.select().from(receipts).all(),
    receiptPages: db.select().from(receiptPages).all(),
    lineItems: db.select().from(lineItems).all(),
  };
}

/** DB A with one receipt, one page (image + thumb files), a folder and a line item. */
function seedA() {
  const db = testDb();
  const f = createFolder(db, { name: "Bali trip", kind: "trip" });
  const r = addReceipt(db, { folderId: f.id, refNo: "INV-001" });
  db.insert(lineItems)
    .values({ id: "li-1", createdAt: 1, updatedAt: 1, receiptId: r.id, description: "Kopi", qty: 1, amountMinor: 12500 })
    .run();
  createPage(db, { receiptId: r.id, pageIndex: 0, imagePath: P("img-a"), thumbPath: P("thumb-a"), width: 1, height: 1, dhash: null });
  const files = new Map([
    [P("img-a"), new Uint8Array([1, 2, 3])],
    [P("thumb-a"), new Uint8Array([4, 5])],
  ]);
  return { db, r, files };
}

async function exportOf(db: AppDb, files: Map<string, Uint8Array>, passphrase: string | null = null, pr = prefs()) {
  const m = memSink();
  await exportBackup({ db, prefs: pr, store: fakeStore(files).store, sink: m.sink, passphrase, now: 1, appVersion: "1.0.0" });
  return m.bytes();
}

/** Hand-built archive (unencrypted) for snapshots exportBackup would never write. */
async function archiveOf(snapshot: unknown, opts: { schemaVersion?: number; pages?: [string, Uint8Array][] } = {}) {
  const m = memSink();
  const w = await createArchiveWriter(m.sink, { passphrase: null });
  const pages = opts.pages ?? [];
  await w.manifest({ schemaVersion: opts.schemaVersion ?? SCHEMA_VERSION, pageNames: pages.map(([n]) => n) });
  await w.snapshot(snapshot as object);
  for (const [n, b] of pages) await w.page(n, b);
  await w.finish();
  return m.bytes();
}

/** DB B with a pre-existing receipt and page file. */
function seedB() {
  const db = testDb();
  const r = addReceipt(db, { merchant: "Existing", purchasedAtLocal: "2025-01-01T09:00:00", purchasedAtUtc: 1735693200000, totalMinor: 999, amountHomeMinor: 999 });
  createPage(db, { receiptId: r.id, pageIndex: 0, imagePath: P("b-img"), thumbPath: null, width: 1, height: 1, dhash: null });
  const fs = fakeStore(new Map([[P("b-img"), new Uint8Array([9, 9])]]));
  return { db, r, ...fs };
}

const snapshotOfFiles = (files: Map<string, Uint8Array>) => new Map([...files].map(([k, v]) => [k, [...v]]));

describe("importBackup", () => {
  it("round trip: export A, replace into empty B -> same rows and page bytes", async () => {
    const a = seedA();
    const bytes = await exportOf(a.db, a.files, PASS);
    const db = testDb();
    const b = fakeStore();
    const src = source(bytes);
    const progress: [number, number][] = [];
    const out = await importBackup({ db, prefs: prefs(), store: b.store, source: src, passphrase: PASS, mode: "replace", onProgress: (d, t) => progress.push([d, t]) });
    expect(src.isClosed()).toBe(true);
    expect(out.possibleDuplicates).toEqual([]);
    expect(out.result.insertedReceiptIds).toEqual([a.r.id]);
    expect(progress[progress.length - 1]).toEqual([2, 2]);

    const ra = rows(a.db);
    const rb = rows(db);
    const sortIds = <T extends { id: string }>(x: T[]) => [...x].sort((p, q) => p.id.localeCompare(q.id));
    expect(sortIds(rb.categories)).toEqual(sortIds(ra.categories));
    expect(rb.folders).toEqual(ra.folders);
    expect(rb.receipts).toEqual(ra.receipts);
    expect(rb.lineItems).toEqual(ra.lineItems);
    const strip = (p: (typeof ra.receiptPages)[number]) => ({ ...p, imagePath: "", thumbPath: "" });
    expect(rb.receiptPages.map(strip)).toEqual(ra.receiptPages.map(strip));

    const pb = rb.receiptPages[0];
    expect(pb.imagePath).not.toBe(P("img-a"));
    expect([...(await b.store.readPlain(pb.imagePath))]).toEqual([1, 2, 3]);
    expect([...(await b.store.readPlain(pb.thumbPath!))]).toEqual([4, 5]);
    expect(b.files.size).toBe(2);
  });

  it("wrong passphrase -> WrongPassphraseError, B unchanged, no new files", async () => {
    const a = seedA();
    const bytes = await exportOf(a.db, a.files, PASS);
    const b = seedB();
    const before = rows(b.db);
    const filesBefore = snapshotOfFiles(b.files);
    const src = source(bytes);
    await expect(
      importBackup({ db: b.db, prefs: prefs(), store: b.store, source: src, passphrase: "wrong horse", mode: "replace" }),
    ).rejects.toBeInstanceOf(WrongPassphraseError);
    expect(src.isClosed()).toBe(true);
    expect(rows(b.db)).toEqual(before);
    expect(snapshotOfFiles(b.files)).toEqual(filesBefore);
  });

  const pdf = new Uint8Array(Buffer.from("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n", "utf8"));
  it.each([
    ["a PDF", async () => pdf],
    ["an empty file", async () => new Uint8Array()],
    ["a truncated .meb", async () => {
      const a = seedA();
      const full = await exportOf(a.db, a.files);
      return full.slice(0, full.length - 3);
    }],
  ])("%s -> ArchiveFormatError, rows and files unchanged", async (_label, make) => {
    const bytes = await make();
    for (const mode of ["replace", "merge"] as const) {
      const b = seedB();
      const before = rows(b.db);
      const filesBefore = snapshotOfFiles(b.files);
      await expect(
        importBackup({ db: b.db, prefs: prefs(), store: b.store, source: source(bytes), passphrase: null, mode }),
      ).rejects.toBeInstanceOf(ArchiveFormatError);
      expect(rows(b.db)).toEqual(before);
      expect(snapshotOfFiles(b.files)).toEqual(filesBefore);
    }
  });

  it("importPage throwing on the 2nd page -> error, 1st new file deleted, old rows and files intact", async () => {
    const a = seedA();
    const bytes = await exportOf(a.db, a.files);
    const db = seedB().db;
    const fs = fakeStore(new Map([[P("b-img"), new Uint8Array([9, 9])]]), { failImportAt: 2 });
    const before = rows(db);
    const filesBefore = snapshotOfFiles(fs.files);
    await expect(
      importBackup({ db, prefs: prefs(), store: fs.store, source: source(bytes), passphrase: null, mode: "replace" }),
    ).rejects.toThrow("disk full");
    expect(fs.imported).toHaveLength(1);
    expect(fs.files.has(fs.imported[0])).toBe(false);
    expect(rows(db)).toEqual(before);
    expect(snapshotOfFiles(fs.files)).toEqual(filesBefore);
  });

  it("snapshot failing validation -> ArchiveFormatError, page files written so far removed", async () => {
    const bad = { ...collectSnapshot(seedA().db, prefs()), extra: true };
    const bytes = await archiveOf(bad, { pages: [["x.enc", new Uint8Array([1])]] });
    const b = seedB();
    const before = rows(b.db);
    const filesBefore = snapshotOfFiles(b.files);
    await expect(
      importBackup({ db: b.db, prefs: prefs(), store: b.store, source: source(bytes), passphrase: null, mode: "merge" }),
    ).rejects.toBeInstanceOf(ArchiveFormatError);
    expect(rows(b.db)).toEqual(before);
    expect(snapshotOfFiles(b.files)).toEqual(filesBefore);
  });

  it("DB write failing -> error, new page files removed, old rows and files intact", async () => {
    const s = collectSnapshot(seedA().db, prefs());
    const dup: Snapshot = { ...s, receipts: [s.receipts[0], s.receipts[0]] }; // PK violation mid-transaction
    const bytes = await archiveOf(dup, { pages: [["img-a.enc", new Uint8Array([1])]] });
    const b = seedB();
    const before = rows(b.db);
    const filesBefore = snapshotOfFiles(b.files);
    await expect(
      importBackup({ db: b.db, prefs: prefs(), store: b.store, source: source(bytes), passphrase: null, mode: "replace" }),
    ).rejects.toThrow();
    expect(b.imported).toHaveLength(1);
    expect(rows(b.db)).toEqual(before);
    expect(snapshotOfFiles(b.files)).toEqual(filesBefore);
  });

  it("schemaVersion newer than the app -> ArchiveVersionError", async () => {
    const bytes = await archiveOf(collectSnapshot(testDb(), prefs()), { schemaVersion: SCHEMA_VERSION + 1 });
    const b = seedB();
    const before = rows(b.db);
    await expect(
      importBackup({ db: b.db, prefs: prefs(), store: b.store, source: source(bytes), passphrase: null, mode: "merge" }),
    ).rejects.toBeInstanceOf(ArchiveVersionError);
    expect(rows(b.db)).toEqual(before);
  });

  it("merging receipts saved under home EUR into home IDR counts them unconverted, never adds them", async () => {
    const a = testDb();
    for (let i = 0; i < 2; i++) {
      addReceipt(a, {
        merchant: `Café ${i}`,
        currency: "EUR",
        totalMinor: 1000,
        fxRate: "1",
        fxRateDate: "2026-03-01",
        homeCurrencyAtSave: "EUR",
        amountHomeMinor: 1000,
      });
    }
    const bytes = await exportOf(a, new Map(), null, prefs("EUR"));
    const b = seedB();
    const pr = prefs("IDR"); // empty FX cache
    const out = await importBackup({ db: b.db, prefs: pr, store: b.store, source: source(bytes), passphrase: null, mode: "merge" });
    expect(out.result.inserted).toBe(2);
    const t = sumHome(b.db, {}, "IDR");
    expect(t.count).toBe(3);
    expect(t.unconverted).toBe(2);
    expect(t.homeMinor).toBe(999); // only the local IDR receipt
    expect(pr.get("homeCurrency")).toBe("IDR");
  });

  it("merge flags an imported receipt matching a local one by refNo", async () => {
    const a = testDb();
    const imported = addReceipt(a, { merchant: "Other Shop", refNo: "REF-42", totalMinor: 777, amountHomeMinor: 777 });
    const bytes = await exportOf(a, new Map());
    const b = seedB();
    const local = addReceipt(b.db, { merchant: "Local", refNo: "REF-42", totalMinor: 555, amountHomeMinor: 555, purchasedAtLocal: "2024-01-01T00:00:00", purchasedAtUtc: 1704067200000 });
    const out = await importBackup({ db: b.db, prefs: prefs(), store: b.store, source: source(bytes), passphrase: null, mode: "merge" });
    expect(out.possibleDuplicates).toEqual([{ receiptId: imported.id, matchId: local.id }]);
  });

  it("replace sets homeCurrency and taxYearStartMonth from the archive; merge leaves them", async () => {
    const a = seedA();
    const bytes = await exportOf(a.db, a.files, null, prefs("USD", 4));

    const rep = seedB();
    const prRep = prefs("IDR", 1);
    await importBackup({ db: rep.db, prefs: prRep, store: rep.store, source: source(bytes), passphrase: null, mode: "replace" });
    expect(prRep.get("homeCurrency")).toBe("USD");
    expect(prRep.get("taxYearStartMonth")).toBe(4);

    const mer = seedB();
    const prMer = prefs("IDR", 1);
    await importBackup({ db: mer.db, prefs: prMer, store: mer.store, source: source(bytes), passphrase: null, mode: "merge" });
    expect(prMer.get("homeCurrency")).toBe("IDR");
    expect(prMer.get("taxYearStartMonth")).toBe(1);
  });

  it("replace removes the old page files after commit", async () => {
    const a = seedA();
    const bytes = await exportOf(a.db, a.files);
    const b = seedB();
    await importBackup({ db: b.db, prefs: prefs(), store: b.store, source: source(bytes), passphrase: null, mode: "replace" });
    expect(b.files.has(P("b-img"))).toBe(false);
    expect([...b.files.keys()].sort()).toEqual([...b.imported].sort());
    expect(rows(b.db).receipts.map((r) => r.id)).toEqual([a.r.id]);
  });

  it("a throwing cleanupOrphanPages after commit does not reject the import", async () => {
    const a = seedA();
    const bytes = await exportOf(a.db, a.files);
    const db = testDb();
    const fs = fakeStore(new Map(), { failCleanup: true });
    await expect(
      importBackup({ db, prefs: prefs(), store: fs.store, source: source(bytes), passphrase: null, mode: "merge" }),
    ).resolves.toMatchObject({ result: { inserted: 1 } });
    expect(rows(db).receipts).toHaveLength(1);
    expect(fs.files.size).toBe(2);
  });

  it("keeps a page path with no page record (file missing at backup time)", async () => {
    const a = seedA();
    a.files.delete(P("thumb-a")); // exported as missing
    const bytes = await exportOf(a.db, a.files);
    const db = testDb();
    const fs = fakeStore();
    await importBackup({ db, prefs: prefs(), store: fs.store, source: source(bytes), passphrase: null, mode: "replace" });
    const page = rows(db).receiptPages[0];
    expect(page.thumbPath).toBe(P("thumb-a"));
    expect(fs.files.has(page.imagePath)).toBe(true);
  });
});
