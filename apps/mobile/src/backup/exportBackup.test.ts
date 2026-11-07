import { createPage, softDeletePages } from "@/db/repositories/pages";
import { createReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { ImageStore } from "@/images/store";
import { createPrefs, type KV } from "@/prefs/prefs";

import { type ByteSink, openArchive } from "./container";
import { exportBackup } from "./exportBackup";
import { collectSnapshot } from "./snapshot";

const PASS = "correct horse";

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
  return { sink, isClosed: () => closed, bytes: () => new Uint8Array(Buffer.concat(chunks)) };
}

function source(data: Uint8Array) {
  let pos = 0;
  return {
    async read(n: number) {
      const out = data.slice(pos, pos + n);
      pos += out.length;
      return out;
    },
    async close() {},
  };
}

function prefs() {
  const m = new Map<string, string>();
  const kv: KV = { getString: (k) => m.get(k), set: (k, v) => void m.set(k, v), delete: (k) => void m.delete(k) };
  const p = createPrefs(kv);
  p.set("homeCurrency", "IDR");
  return p;
}

function fakeStore(files: Map<string, Uint8Array>, failRead = new Set<string>()): ImageStore {
  return {
    exists: async (p: string) => files.has(p),
    readPlain: async (p: string) => {
      if (failRead.has(p)) throw new Error("decrypt failed");
      const b = files.get(p);
      if (!b) throw new Error("ENOENT");
      return b;
    },
  } as unknown as ImageStore;
}

const P = (n: string) => `pages/${n}.enc`;

function seed() {
  const db = testDb();
  const r = createReceipt(db, {
    merchant: "Toko",
    purchasedAtLocal: "2026-03-01T10:00:00",
    purchasedAtUtc: 1772334000000,
    scannedAtUtc: 1772334060000,
    currency: "IDR",
    totalMinor: 12500,
    parseSource: "manual",
    status: "confirmed",
  });
  const page = (idx: number, img: string, thumb: string | null, receiptId = r.id) =>
    createPage(db, { receiptId, pageIndex: idx, imagePath: P(img), thumbPath: thumb ? P(thumb) : null, width: 1, height: 1, dhash: null });
  return { db, r, page };
}

const base = { passphrase: PASS, now: 1000, appVersion: "1.0.0" };

describe("exportBackup", () => {
  it("round-trips snapshot and page bytes; shared imagePath yields one record", async () => {
    const { db, page } = seed();
    page(0, "img-a", "thumb-a");
    page(1, "img-a", "thumb-b"); // split receipt: shared image
    const files = new Map([
      [P("img-a"), new Uint8Array([1, 2, 3])],
      [P("thumb-a"), new Uint8Array([4])],
      [P("thumb-b"), new Uint8Array([5, 6])],
    ]);
    const m = memSink();
    const pr = prefs();
    const progress: [number, number][] = [];
    const res = await exportBackup({ ...base, db, prefs: pr, store: fakeStore(files), sink: m.sink, onProgress: (d, t) => progress.push([d, t]) });
    expect(res).toEqual({ pages: 3, missing: [] });
    expect(progress[progress.length - 1]).toEqual([3, 3]);

    const reader = await (await openArchive(source(m.bytes()))).unlock(PASS);
    const man = (await reader.manifest()) as { pageNames: string[]; missing: string[]; counts: { receipts: number } };
    expect(man.pageNames.sort()).toEqual(["img-a.enc", "thumb-a.enc", "thumb-b.enc"]);
    expect(man.counts.receipts).toBe(1);
    expect(await reader.snapshot()).toEqual(JSON.parse(JSON.stringify(collectSnapshot(db, pr))));
    const got = new Map<string, Uint8Array>();
    for await (const p of reader.pages()) got.set(p.name, p.bytes);
    expect([...got.get("img-a.enc")!]).toEqual([1, 2, 3]);
    expect([...got.get("thumb-b.enc")!]).toEqual([5, 6]);
    expect(got.size).toBe(3);
  });

  it("excludes deleted pages' files", async () => {
    const { db, r, page } = seed();
    page(0, "img-a", null);
    const r2 = createReceipt(db, {
      purchasedAtLocal: "2026-03-02T10:00:00",
      purchasedAtUtc: 1772420400000,
      scannedAtUtc: 1772420460000,
      currency: "IDR",
      totalMinor: 1,
      parseSource: "manual",
    });
    page(0, "img-gone", "thumb-gone", r2.id);
    softDeletePages(db, r2.id);
    const files = new Map([
      [P("img-a"), new Uint8Array([1])],
      [P("img-gone"), new Uint8Array([2])],
      [P("thumb-gone"), new Uint8Array([3])],
    ]);
    const m = memSink();
    const res = await exportBackup({ ...base, db, prefs: prefs(), store: fakeStore(files), sink: m.sink });
    expect(res.pages).toBe(1);
    expect(r.id).toBeTruthy();
  });

  it("reports a missing file and the archive still opens", async () => {
    const { db, page } = seed();
    page(0, "img-a", "thumb-a");
    const files = new Map([[P("img-a"), new Uint8Array([1])]]);
    const m = memSink();
    const res = await exportBackup({ ...base, db, prefs: prefs(), store: fakeStore(files), sink: m.sink });
    expect(res).toEqual({ pages: 1, missing: [P("thumb-a")] });
    const reader = await (await openArchive(source(m.bytes()))).unlock(PASS);
    const man = (await reader.manifest()) as { pageNames: string[]; missing: string[] };
    expect(man.pageNames).toEqual(["img-a.enc"]);
    expect(man.missing).toEqual([P("thumb-a")]);
    const names: string[] = [];
    for await (const p of reader.pages()) names.push(p.name);
    expect(names).toEqual(["img-a.enc"]);
  });

  it("aborts and closes the sink when a read fails mid-write", async () => {
    const { db, page } = seed();
    page(0, "img-a", "thumb-a");
    const files = new Map([
      [P("img-a"), new Uint8Array([1])],
      [P("thumb-a"), new Uint8Array([2])],
    ]);
    const m = memSink();
    await expect(
      exportBackup({ ...base, db, prefs: prefs(), store: fakeStore(files, new Set([P("thumb-a")])), sink: m.sink }),
    ).rejects.toThrow("decrypt failed");
    expect(m.isClosed()).toBe(true);
  });

  it("works unencrypted with no pages", async () => {
    const { db } = seed();
    const m = memSink();
    const progress: [number, number][] = [];
    const res = await exportBackup({ ...base, passphrase: null, db, prefs: prefs(), store: fakeStore(new Map()), sink: m.sink, onProgress: (d, t) => progress.push([d, t]) });
    expect(res).toEqual({ pages: 0, missing: [] });
    expect(progress[progress.length - 1]).toEqual([0, 0]);
  });
});
