import type { OcrObservation } from "../../modules/receipt-ocr/src/ReceiptOcr.types";
import { listPages } from "@/db/repositories/pages";
import { getReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import type { SavedPage } from "@/images/store";
import { convertToHome } from "@/fx/convert";
import { toMinor } from "@/money/money";
import { parseReceipt } from "@/parsing";
import type { FxCache } from "@/prefs/prefs";

import { analyzeCapture, createDrafts, runCaptures, type CaptureDeps } from "./pipeline";

// Synthetic text only (no real receipts).
const TWO_RECEIPTS = [
  "TOKO MAJU JAYA",
  "Jl. Mawar 1 Bandung",
  "05/11/2026 10:15",
  "Teh Botol 25.000",
  "TOTAL Rp 25.000",
  "TOKO MAJU JAYA",
  "Jl. Mawar 1 Bandung",
  "05/11/2026 11:40",
  "Kopi Susu 40.000",
  "TOTAL Rp 40.000",
];
const USD_RECEIPT = ["CORNER MARKET", "123 Main St", "11/04/2026", "Milk 12.50", "TOTAL $12.50"];
const EUR_RECEIPT = ["CAFE DE LA GARE", "Paris", "03/11/2026", "Cafe 4,20", "TOTAL 4,20 €"];
const NOT_A_RECEIPT = ["shopping list", "remember the milk", "call mom"];

/** One observation per line, stacked top to bottom. */
function obs(lines: string[]): OcrObservation[] {
  return lines.map((text, i) => ({ text, confidence: 1, box: { x: 0.1, y: i * 0.04, w: 0.8, h: 0.03 } }));
}

const NOW = new Date(Date.UTC(2026, 10, 5, 5, 0, 0)); // 2026-11-05 12:00 in Jakarta
const EMPTY_FX: FxCache = { base: "", latestDate: null, fetchedAt: null, byDate: {} };

function fakeImages() {
  const plaintext = new Set<string>();
  const encrypted = new Set<string>();
  const discarded: string[] = [];
  let n = 0;
  let leaseCount = 0;
  const seenLease: boolean[] = [];
  const images = {
    async savePage(_src: string): Promise<SavedPage> {
      seenLease.push(leaseCount > 0);
      const i = n++;
      const normalizedUri = `file:///cache/work/${i}.jpg`;
      plaintext.add(normalizedUri);
      const imagePath = `pages/img-${i}.enc`;
      const thumbPath = `pages/thumb-${i}.enc`;
      encrypted.add(imagePath).add(thumbPath);
      return { imagePath, thumbPath, width: 1200, height: 1600, normalizedUri };
    },
    async openForView(p: string) {
      return p;
    },
    async closeViews() {},
    async readPlain() {
      return new Uint8Array();
    },
    async deleteFiles(paths: string[]) {
      paths.forEach((p) => encrypted.delete(p));
    },
    async purgeDecryptedCache() {},
    async cleanupOrphanPages() {
      return 0;
    },
    async discardPlaintext(uri: string) {
      discarded.push(uri);
      plaintext.delete(uri);
    },
    async purgeCaptureSources() {},
    isCaptureSource: (uri: string) => uri.startsWith("file:///cache/"),
  };
  const lease = () => {
    leaseCount++;
    let done = false;
    return () => {
      if (!done) leaseCount--;
      done = true;
    };
  };
  return { images, plaintext, encrypted, discarded, seenLease, lease, leaseHeld: () => leaseCount > 0 };
}

function setup(
  opts: {
    pages?: Record<string, string[]>;
    ocrThrows?: boolean;
    /** Native calls that never settle (stuck native module). */
    hang?: { ocr?: boolean; hash?: boolean; save?: Promise<SavedPage> };
    home?: string;
    fx?: FxCache;
    fetchFn?: typeof fetch;
  } = {},
) {
  const db: AppDb = testDb();
  const img = fakeImages();
  let fxStored = opts.fx ?? EMPTY_FX;
  const fxSet = jest.fn((c: FxCache) => void (fxStored = c));
  const ocrLease: boolean[] = [];
  const deps: CaptureDeps = {
    db,
    images: img.images,
    ocr: {
      async recognizeText(uri: string) {
        ocrLease.push(img.leaseHeld());
        if (opts.hang?.ocr) return new Promise(() => undefined);
        if (opts.ocrThrows) throw Object.assign(new Error("model init failed"), { code: "ERR_OCR" });
        const i = Number(/(\d+)\.jpg$/.exec(uri)![1]);
        const lines = Object.values(opts.pages ?? {})[i] ?? [];
        return { observations: obs(lines), width: 1200, height: 1600, rotation: 0, ms: 1 };
      },
      async imageHash() {
        if (opts.hang?.hash) return new Promise<string>(() => undefined);
        return "00ff00ff00ff00ff";
      },
    },
    parse: parseReceipt,
    fx: {
      get: () => fxStored,
      set: fxSet,
      fetchFn: opts.fetchFn ?? (jest.fn(async () => Promise.reject(new TypeError("offline"))) as unknown as typeof fetch),
    },
    home: opts.home ?? "IDR",
    uiLanguage: "id",
    clock: () => NOW,
    lease: img.lease,
    timeZone: "Asia/Jakarta",
    stepTimeoutMs: 20,
  };
  if (opts.hang?.save) {
    const late = opts.hang.save;
    deps.images = { ...img.images, savePage: () => late };
  }
  const sources = Object.keys(opts.pages ?? { "file:///cache/ImagePicker/a.jpg": [] });
  return { db, deps, img, sources, fxSet, ocrLease, getFx: () => fxStored };
}

describe("capture pipeline", () => {
  it("creates one draft per segment when split", async () => {
    const { db, deps, sources } = setup({ pages: { "file:///cache/ImagePicker/a.jpg": TWO_RECEIPTS } });
    const a = await analyzeCapture(sources, deps);
    expect(a.splitReason).toBe("repeated-header");
    expect(a.segments).toHaveLength(2);
    const ids = await createDrafts(a, "split", deps);
    expect(ids).toHaveLength(2);
    const [r1, r2] = ids.map((id) => getReceipt(db, id)!);
    expect(r1.totalMinor).toBe(toMinor("25000", "IDR"));
    expect(r2.totalMinor).toBe(toMinor("40000", "IDR"));
    for (const r of [r1, r2]) {
      expect(r.status).toBe("draft");
      expect(r.parseSource).toBe("heuristic");
      expect(r.currency).toBe("IDR");
      expect(r.purchasedAtLocal.slice(0, 10)).toBe("2026-11-05");
      expect(r.purchasedTz).toBe("Asia/Jakarta");
      expect(r.scannedAtUtc).toBe(NOW.getTime());
      expect(r.scannedTz).toBe("Asia/Jakarta");
      expect(r.fxRate).toBe("1");
      expect(r.amountHomeMinor).toBe(r.totalMinor);
      expect(r.homeCurrencyAtSave).toBe("IDR");
    }
    expect(r1.purchasedAtLocal).toBe("2026-11-05T10:15:00");
    expect(r1.purchasedAtUtc).toBe(Date.UTC(2026, 10, 5, 3, 15, 0));
    expect(r1.rawOcrText).toBe(a.segments[0].join("\n"));
    expect(r2.rawOcrText).toBe(a.segments[1].join("\n"));
    const p1 = listPages(db, r1.id);
    const p2 = listPages(db, r2.id);
    expect(p1).toHaveLength(1);
    expect(p2).toHaveLength(1);
    expect(p1[0].id).not.toBe(p2[0].id);
    expect(p1[0].imagePath).toBe(p2[0].imagePath);
    expect(p1[0].thumbPath).toBe(p2[0].thumbPath);
    expect(p1[0].dhash).toBe("00ff00ff00ff00ff");
  });

  it("keep-as-one sums segment totals", async () => {
    const { db, deps, sources } = setup({ pages: { "file:///cache/ImagePicker/a.jpg": TWO_RECEIPTS } });
    const a = await analyzeCapture(sources, deps);
    const ids = await createDrafts(a, "single", deps);
    expect(ids).toHaveLength(1);
    const r = getReceipt(db, ids[0])!;
    expect(r.totalMinor).toBe(toMinor("65000", "IDR"));
    expect(r.rawOcrText).toBe(a.lines.join("\n"));
    expect(listPages(db, r.id)).toHaveLength(1);
  });

  it("creates manual draft when parse finds nothing", async () => {
    const { db, deps, sources } = setup({ pages: { "file:///cache/ImagePicker/a.jpg": NOT_A_RECEIPT } });
    const a = await analyzeCapture(sources, deps);
    expect(a.ocrFailed).toBe(false);
    const [id] = await createDrafts(a, "split", deps);
    const r = getReceipt(db, id)!;
    expect(r.parseSource).toBe("manual");
    expect(r.status).toBe("draft");
    expect(r.totalMinor).toBe(0);
    expect(r.merchant).toBeNull();
    expect(r.amountHomeMinor).toBeNull();
    expect(r.fxRate).toBeNull();
    expect(r.purchasedAtLocal).toBe("2026-11-05T12:00:00"); // scan time, Jakarta wall clock
    expect(r.rawOcrText).toBe(NOT_A_RECEIPT.join("\n"));
    const conf = JSON.parse(r.parseConfidence!);
    expect(conf.total).toBe(0);
    expect(conf.date).toBe(0);
    expect(conf.merchant).toBe(0);
    expect(listPages(db, id)).toHaveLength(1);
  });

  it("falls back to manual draft when OCR throws", async () => {
    const { db, deps, img, sources } = setup({
      pages: { "file:///cache/ImagePicker/a.jpg": TWO_RECEIPTS },
      ocrThrows: true,
    });
    const a = await analyzeCapture(sources, deps);
    expect(a.ocrFailed).toBe(true);
    expect(a.segments).toEqual([[]]);
    const ids = await createDrafts(a, "split", deps);
    expect(ids).toHaveLength(1);
    const r = getReceipt(db, ids[0])!;
    expect(r.parseSource).toBe("manual");
    expect(r.totalMinor).toBe(0);
    expect(r.currency).toBe("IDR");
    expect(r.rawOcrText).toBeNull();
    // image still saved
    const pages = listPages(db, r.id);
    expect(pages).toHaveLength(1);
    expect(img.encrypted.has(pages[0].imagePath)).toBe(true);
    expect(img.plaintext.size).toBe(0);
  });

  it("OCR / hash timeout: manual draft keeps the image, lease released, plaintext deleted", async () => {
    const { db, deps, img, sources } = setup({
      pages: { "file:///cache/ImagePicker/a.jpg": USD_RECEIPT },
      hang: { ocr: true, hash: true },
    });
    const res = await runCaptures([sources], deps, { chooseSplit: async () => "split" });
    expect(res).toMatchObject({ failed: 0, cancelled: false });
    expect(res.ids).toHaveLength(1);
    const r = getReceipt(db, res.ids[0])!;
    expect(r.parseSource).toBe("manual");
    const pages = listPages(db, r.id);
    expect(pages).toHaveLength(1);
    expect(pages[0].dhash).toBeNull();
    expect(img.encrypted.has(pages[0].imagePath)).toBe(true);
    expect(img.plaintext.size).toBe(0);
    expect(img.discarded).toContain(sources[0]);
    expect(img.leaseHeld()).toBe(false);
  });

  it("savePage timeout fails the photo; a late result has its files deleted", async () => {
    let finish!: (s: SavedPage) => void;
    const save = new Promise<SavedPage>((r) => (finish = r));
    const { db, deps, img, sources } = setup({ hang: { save } });
    const res = await runCaptures([sources], deps, { chooseSplit: async () => "split" });
    expect(res).toEqual({ ids: [], failed: 1, cancelled: false });
    expect(img.leaseHeld()).toBe(false);
    expect(img.discarded).toContain(sources[0]);
    expect(listPages(db, "x")).toHaveLength(0);
    img.encrypted.add("pages/late.enc").add("pages/late-t.enc");
    finish({ imagePath: "pages/late.enc", thumbPath: "pages/late-t.enc", width: 1, height: 1, normalizedUri: "file:///cache/work/late.jpg" });
    await new Promise((r) => setTimeout(r, 0));
    expect(img.discarded).toContain("file:///cache/work/late.jpg");
    expect(img.encrypted.size).toBe(0);
  });

  it("cancel (abort) abandons a stuck OCR call at once and cleans up", async () => {
    const { deps, img, sources } = setup({
      pages: { "file:///cache/ImagePicker/a.jpg": USD_RECEIPT, "file:///cache/ImagePicker/b.jpg": USD_RECEIPT },
      hang: { ocr: true },
    });
    const ctrl = new AbortController();
    let cancelled = false;
    const run = runCaptures(sources.map((s) => [s]), { ...deps, stepTimeoutMs: 60_000, signal: ctrl.signal }, {
      chooseSplit: async () => "split",
      isCancelled: () => cancelled,
    });
    await new Promise((r) => setTimeout(r, 5));
    expect(img.leaseHeld()).toBe(true);
    cancelled = true;
    ctrl.abort();
    const res = await run;
    expect(res).toMatchObject({ ids: [], cancelled: true });
    expect(img.leaseHeld()).toBe(false);
    expect(img.plaintext.size).toBe(0);
    expect(img.encrypted.size).toBe(0);
    expect(img.discarded).toEqual(expect.arrayContaining(sources));
  });

  it("deletes normalized plaintext files", async () => {
    const pages = {
      "file:///cache/scan/p1.jpg": USD_RECEIPT.slice(0, 3),
      "file:///cache/scan/p2.jpg": USD_RECEIPT.slice(3),
    };
    const { db, deps, img, sources, ocrLease } = setup({ pages, home: "USD" });
    const a = await analyzeCapture(sources, deps);
    expect(a.pages).toHaveLength(2);
    expect(a.lines).toEqual(USD_RECEIPT);
    // normalized work files and the picker/scanner sources are gone right after analysis
    expect(img.plaintext.size).toBe(0);
    expect(img.discarded).toEqual(expect.arrayContaining([...sources, "file:///cache/work/0.jpg", "file:///cache/work/1.jpg"]));
    // the capture lease covered every savePage and OCR call, and is released after
    expect(img.seenLease).toEqual([true, true]);
    expect(ocrLease).toEqual([true, true]);
    expect(img.leaseHeld()).toBe(false);
    const [id] = await createDrafts(a, "split", deps);
    const rows = listPages(db, id);
    expect(rows.map((p) => p.pageIndex)).toEqual([0, 1]);
    expect(rows.map((p) => p.dhash)).toEqual(["00ff00ff00ff00ff", null]);
  });

  it("sets FX fields for foreign currency and null when unavailable", async () => {
    const fx: FxCache = {
      base: "idr",
      latestDate: "2026-11-04",
      fetchedAt: NOW.getTime() - 1000,
      byDate: { "2026-11-04": { usd: "0.0000613" } },
    };
    const usd = setup({ pages: { "file:///cache/ImagePicker/a.jpg": USD_RECEIPT }, fx });
    const [id] = await createDrafts(await analyzeCapture(usd.sources, usd.deps), "split", usd.deps);
    const r = getReceipt(usd.db, id)!;
    expect(r.currency).toBe("USD");
    const expected = convertToHome(r.totalMinor, "USD", "IDR", "2026-11-04", fx)!;
    expect(r.amountHomeMinor).toBe(expected.amountHomeMinor);
    expect(r.fxRate).toBe(expected.fxRate);
    expect(r.fxRateDate).toBe("2026-11-04");
    expect(r.fxApproximate).toBe(false);
    expect(r.homeCurrencyAtSave).toBe("IDR");

    // EUR is not in the table and the network is down: the draft saves without conversion.
    const eur = setup({ pages: { "file:///cache/ImagePicker/a.jpg": EUR_RECEIPT }, fx });
    const [eid] = await createDrafts(await analyzeCapture(eur.sources, eur.deps), "split", eur.deps);
    const e = getReceipt(eur.db, eid)!;
    expect(e.currency).toBe("EUR");
    expect(e.amountHomeMinor).toBeNull();
    expect(e.fxRate).toBeNull();
    expect(e.fxRateDate).toBeNull();
    expect(e.homeCurrencyAtSave).toBe("IDR");
    expect(eur.fxSet).not.toHaveBeenCalled();

    // Online: the purchase-date table is fetched and persisted.
    const fetchFn = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ date: "2026-11-03", idr: { eur: 0.000055 } }),
    })) as unknown as typeof fetch;
    const online = setup({ pages: { "file:///cache/ImagePicker/a.jpg": EUR_RECEIPT }, fx, fetchFn });
    const [oid] = await createDrafts(await analyzeCapture(online.sources, online.deps), "split", online.deps);
    const o = getReceipt(online.db, oid)!;
    expect(o.fxRateDate).toBe("2026-11-03");
    expect(o.amountHomeMinor).not.toBeNull();
    expect(online.fxSet).toHaveBeenCalledTimes(1);
    expect(online.getFx().byDate["2026-11-03"]).toEqual({ eur: "0.000055" });
  });

  it("runs imported photos one at a time, skips failures and cleans up on cancel", async () => {
    const pages = {
      "file:///cache/ImagePicker/a.jpg": TWO_RECEIPTS,
      "file:///cache/ImagePicker/b.jpg": USD_RECEIPT,
      "file:///cache/ImagePicker/c.jpg": EUR_RECEIPT,
    };
    const { db, deps, img, sources } = setup({ pages });
    const savePage = img.images.savePage;
    let inFlight = 0;
    let maxInFlight = 0;
    let calls = 0;
    deps.images = {
      ...img.images,
      async savePage(uri: string) {
        if (calls++ === 1) throw new Error("disk full");
        maxInFlight = Math.max(maxInFlight, ++inFlight);
        try {
          return await savePage(uri);
        } finally {
          inFlight--;
        }
      },
    };
    const chooseSplit = jest.fn(async () => "split" as const);
    const out = await runCaptures(sources.map((s) => [s]), deps, { chooseSplit });
    expect(maxInFlight).toBe(1);
    expect(chooseSplit).toHaveBeenCalledWith(2);
    expect(out.failed).toBe(1);
    expect(out.ids).toHaveLength(3); // 2 split drafts from a.jpg + 1 from c.jpg
    expect(out.ids.every((id) => getReceipt(db, id)?.status === "draft")).toBe(true);
    expect(img.discarded).toEqual(expect.arrayContaining(sources));

    // Cancel at the split prompt: nothing saved, encrypted pages deleted, later sources deleted.
    const c = setup({ pages });
    const res = await runCaptures(c.sources.map((s) => [s]), c.deps, { chooseSplit: async () => null });
    expect(res).toEqual({ ids: [], failed: 0, cancelled: true });
    expect(c.img.encrypted.size).toBe(0);
    expect(c.img.discarded).toEqual(expect.arrayContaining(c.sources));
  });

  it("never reads or deletes URIs outside the capture allow-list", async () => {
    const { db, deps, img } = setup({ pages: { "file:///cache/ImagePicker/a.jpg": USD_RECEIPT } });
    const out = await runCaptures(
      [["content://com.other.app/doc/1"], ["file:///cache/ImagePicker/a.jpg"], ["file:///doc/pages/x.enc"]],
      deps,
      { chooseSplit: async () => "split" },
    );
    expect(out.failed).toBe(2);
    expect(out.ids).toHaveLength(1);
    expect(img.seenLease).toHaveLength(1); // only the allowed photo reached savePage
    expect(img.discarded).not.toContain("content://com.other.app/doc/1");
    expect(img.discarded).not.toContain("file:///doc/pages/x.enc");
    expect(getReceipt(db, out.ids[0])?.currency).toBe("USD");
  });
});
