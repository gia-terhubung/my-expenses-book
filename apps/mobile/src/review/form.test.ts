import { testDb } from "@/db/testing/testDb";
import { getReceipt } from "@/db/repositories/receipts";
import { listPages } from "@/db/repositories/pages";

import { amountText, parseAmountInput, parseRate, validate, valuesFromReceipt, type ReviewValues } from "./form";
import { createManualDraft } from "./manualDraft";

describe("review form helpers", () => {
  it("parses typed amounts with either decimal mark", () => {
    expect(parseAmountInput("25.000", "IDR")).toBe(2500000);
    expect(parseAmountInput("30.000,50", "IDR")).toBe(3000050);
    expect(parseAmountInput("1,234.56", "USD")).toBe(123456);
    expect(parseAmountInput("12,5", "EUR")).toBe(1250);
    expect(parseAmountInput("1.500", "JPY")).toBe(1500);
    expect(parseAmountInput("", "USD")).toBeNull();
    expect(parseAmountInput("12.", "USD")).toBeNull();
    expect(parseAmountInput("-5", "USD")).toBeNull();
    expect(parseAmountInput("abc", "USD")).toBeNull();
  });

  it("shows amounts without an all-zero fraction", () => {
    expect(amountText(2500000, "IDR")).toBe("25000");
    expect(amountText(1250, "USD")).toBe("12.50");
  });

  it("accepts only positive decimal rates", () => {
    expect(parseRate("16250,5")).toBe("16250.5");
    expect(parseRate("0")).toBeNull();
    expect(parseRate("1e5")).toBeNull();
    expect(parseRate("-1")).toBeNull();
  });

  it("validates total, currency, date, time and rate", () => {
    const ok: ReviewValues = {
      merchant: "",
      date: "2026-11-05",
      time: "",
      total: "10",
      currency: "USD",
      tax: "",
      categoryId: null,
      notes: "",
      fxRate: "",
    };
    expect(validate(ok)).toEqual({});
    expect(validate({ ...ok, total: "0" }).total).toBe("review.errors.totalInvalid");
    expect(validate({ ...ok, currency: "XXX1" }).currency).toBe("review.errors.currencyUnknown");
    expect(validate({ ...ok, date: "" }).date).toBe("review.errors.dateRequired");
    expect(validate({ ...ok, date: "2026-02-30" }).date).toBe("review.errors.dateInvalid");
    expect(validate({ ...ok, time: "25:00" }).time).toBe("review.errors.timeInvalid");
    expect(validate({ ...ok, fxRate: "x" }).fxRate).toBe("review.errors.rateInvalid");
  });
});

describe("createManualDraft", () => {
  it("creates an empty manual draft with no pages and an unknown total", () => {
    const db = testDb();
    const id = createManualDraft(db, { home: "IDR", now: new Date(Date.UTC(2026, 10, 5, 5, 0)), timeZone: "Asia/Jakarta" });
    const r = getReceipt(db, id)!;
    expect(r).toMatchObject({
      status: "draft",
      parseSource: "manual",
      currency: "IDR",
      totalMinor: 0,
      purchasedAtLocal: "2026-11-05T12:00:00",
      purchasedTz: "Asia/Jakarta",
      parseConfidence: null,
    });
    expect(listPages(db, id)).toEqual([]);
    expect(valuesFromReceipt(r).total).toBe("");
  });
});
