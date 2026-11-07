import { createReceipt, getReceipt, softDeleteReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { NewReceiptInput } from "@/db/types";
import type { FxCache } from "@/prefs/prefs";

import { reconvertAll, receiptDatesNeedingRates, needsReconvert } from "./reconvert";

function input(over: Partial<NewReceiptInput> = {}): NewReceiptInput {
  return {
    merchant: "Shop",
    purchasedAtLocal: "2026-11-01T10:00:00",
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: 1772334000000,
    scannedAtUtc: 1772334060000,
    scannedTz: "Asia/Jakarta",
    currency: "USD",
    totalMinor: 1234,
    parseSource: "heuristic",
    ...over,
  };
}

const cache: FxCache = {
  base: "idr",
  latestDate: "2026-11-01",
  fetchedAt: 0,
  byDate: { "2026-11-01": { usd: "0.00005" } },
};

describe("reconvertAll", () => {
  it("updates two receipts and skips soft-deleted", () => {
    const db = testDb();
    const a = createReceipt(db, input());
    const b = createReceipt(db, input({ currency: "IDR", totalMinor: 500 }));
    const gone = createReceipt(db, input());
    softDeleteReceipt(db, gone.id);

    expect(reconvertAll(db, "IDR", cache)).toBe(2);

    expect(getReceipt(db, a.id)).toMatchObject({
      fxRate: "20000",
      fxRateDate: "2026-11-01",
      amountHomeMinor: 24680000,
      fxApproximate: false,
      homeCurrencyAtSave: "IDR",
    });
    expect(getReceipt(db, b.id)).toMatchObject({ fxRate: "1", amountHomeMinor: 500, homeCurrencyAtSave: "IDR" });
    expect(getReceipt(db, a.id)?.version).toBe(2);
  });

  it("clears fx fields when no rate is available", () => {
    const db = testDb();
    const a = createReceipt(db, input({ fxRate: "9", amountHomeMinor: 9, homeCurrencyAtSave: "EUR" }));
    reconvertAll(db, "IDR", { ...cache, byDate: {} });
    expect(getReceipt(db, a.id)).toMatchObject({
      fxRate: null,
      fxRateDate: null,
      amountHomeMinor: null,
      fxApproximate: false,
      homeCurrencyAtSave: "IDR",
    });
  });

  it("needsReconvert and receiptDatesNeedingRates", () => {
    const db = testDb();
    expect(needsReconvert(db, "IDR")).toBe(false);
    const a = createReceipt(db, input({ homeCurrencyAtSave: "IDR", amountHomeMinor: 1, fxRate: "1" }));
    createReceipt(db, input({ currency: "IDR", purchasedAtLocal: "2026-10-01T10:00:00" }));
    expect(needsReconvert(db, "IDR")).toBe(true); // second has null homeCurrencyAtSave
    reconvertAll(db, "IDR", cache);
    expect(needsReconvert(db, "IDR")).toBe(false);
    expect(needsReconvert(db, "EUR")).toBe(true);
    expect(receiptDatesNeedingRates(db, "IDR")).toEqual([]); // foreign one already converted
    expect(receiptDatesNeedingRates(db, "EUR")).toEqual(["2026-11-01", "2026-10-01"]);
    expect(a.id).toBeDefined();
  });
});

describe("reconvertAll no-op", () => {
  it("second run changes nothing and keeps versions", () => {
    const db = testDb();
    const a = createReceipt(db, input());
    const b = createReceipt(db, input({ currency: "XAF", totalMinor: 5 })); // no rate: stays null
    expect(reconvertAll(db, "IDR", cache)).toBe(2);
    const va = getReceipt(db, a.id)!;
    const vb = getReceipt(db, b.id)!;
    expect(reconvertAll(db, "IDR", cache)).toBe(0);
    expect(getReceipt(db, a.id)).toEqual(va);
    expect(getReceipt(db, b.id)).toEqual(vb);
  });
});

describe("reconvertAll with a manual rate", () => {
  it("keeps a manual rate while home is unchanged, replaces it when home changes", () => {
    const db = testDb();
    const r = createReceipt(db, input({ fxRate: "16000", fxRateDate: null, amountHomeMinor: 19744000, homeCurrencyAtSave: "IDR" }));
    createReceipt(db, input()); // unconverted row triggers a pass
    reconvertAll(db, "IDR", cache);
    expect(getReceipt(db, r.id)).toMatchObject({ fxRate: "16000", fxRateDate: null, amountHomeMinor: 19744000 });
    reconvertAll(db, "EUR", { ...cache, base: "eur" });
    expect(getReceipt(db, r.id)).toMatchObject({ fxRate: "20000", fxRateDate: "2026-11-01", homeCurrencyAtSave: "EUR" });
  });
});

describe("reconvertAll never downgrades a conversion for the same home", () => {
  it("keeps the existing conversion when the cache no longer has a rate (pruned date)", () => {
    const db = testDb();
    const a = createReceipt(db, input());
    reconvertAll(db, "IDR", cache);
    const before = getReceipt(db, a.id)!;
    expect(before.amountHomeMinor).toBe(24680000);
    expect(reconvertAll(db, "IDR", { ...cache, byDate: {} })).toBe(0);
    expect(getReceipt(db, a.id)).toEqual(before);
  });

  it("keeps an exact-date conversion over a nearest-earlier (approximate) one", () => {
    const db = testDb();
    const a = createReceipt(db, input());
    reconvertAll(db, "IDR", cache);
    const before = getReceipt(db, a.id)!;
    expect(reconvertAll(db, "IDR", { ...cache, byDate: { "2026-10-01": { usd: "0.00004" } } })).toBe(0);
    expect(getReceipt(db, a.id)).toEqual(before);
  });

  it("still upgrades an approximate conversion when the exact date arrives", () => {
    const db = testDb();
    const a = createReceipt(db, input());
    reconvertAll(db, "IDR", { ...cache, byDate: { "2026-10-01": { usd: "0.00004" } } });
    expect(getReceipt(db, a.id)).toMatchObject({ fxApproximate: true, fxRateDate: "2026-10-01" });
    reconvertAll(db, "IDR", cache);
    expect(getReceipt(db, a.id)).toMatchObject({ fxApproximate: false, fxRateDate: "2026-11-01", amountHomeMinor: 24680000 });
  });
});

describe("receiptDatesNeedingRates", () => {
  it("lists only dates of receipts still needing work, skips known dates, caps per call", () => {
    const db = testDb();
    createReceipt(db, input({ purchasedAtLocal: "2026-11-03T10:00:00", homeCurrencyAtSave: "IDR", amountHomeMinor: 1, fxRate: "1" })); // done
    createReceipt(db, input({ purchasedAtLocal: "2026-11-02T10:00:00" })); // never converted
    createReceipt(db, input({ purchasedAtLocal: "2026-11-01T10:00:00", homeCurrencyAtSave: "EUR", amountHomeMinor: 1 })); // other home
    createReceipt(db, input({ purchasedAtLocal: "2026-10-31T10:00:00", homeCurrencyAtSave: "IDR", amountHomeMinor: 1, fxApproximate: true }));
    createReceipt(db, input({ purchasedAtLocal: "2026-10-30T10:00:00", currency: "IDR" })); // home currency: no rate needed
    expect(receiptDatesNeedingRates(db, "IDR")).toEqual(["2026-11-02", "2026-11-01", "2026-10-31"]);
    expect(receiptDatesNeedingRates(db, "IDR", (d) => d === "2026-11-02")).toEqual(["2026-11-01", "2026-10-31"]);
    expect(receiptDatesNeedingRates(db, "IDR", () => false, 2)).toEqual(["2026-11-02", "2026-11-01"]);
  });
});
