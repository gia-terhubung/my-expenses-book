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
    expect(receiptDatesNeedingRates(db, "IDR")).toEqual(["2026-11-01"]); // foreign only
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
