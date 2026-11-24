import { testDb } from "@/db/testing/testDb";
import { createFolder } from "@/db/repositories/folders";
import { createReceipt, getReceipt } from "@/db/repositories/receipts";
import { listPages } from "@/db/repositories/pages";

import { amountText, draftPatch, parseAmountInput, parseRate, validate, valuesFromReceipt, type ReviewValues } from "./form";
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

  it("amountText writes the decimal mark of the app language (Spain and Brazil use a comma)", () => {
    expect(amountText(2345, "EUR", "es")).toBe("23,45");
    expect(amountText(4125, "BRL", "pt-BR")).toBe("41,25");
    expect(amountText(1250, "USD", "en")).toBe("12.50");
    expect(amountText(2500000, "IDR", "id")).toBe("25000");
  });

  it("amountText works without Intl formatToParts (Hermes has none: the review screen crashed on device)", () => {
    const proto = Intl.NumberFormat.prototype as { formatToParts?: unknown };
    const saved = proto.formatToParts;
    delete proto.formatToParts;
    try {
      expect(amountText(2345, "EUR", "es")).toBe("23,45");
    } finally {
      proto.formatToParts = saved;
    }
  });

  it("amountText output reads back through parseAmountInput in every language", () => {
    for (const [minor, cur, lang] of [[2345, "EUR", "es"], [4125, "BRL", "pt-BR"], [1250, "USD", "en"]] as const) {
      expect(parseAmountInput(amountText(minor, cur, lang), cur)).toBe(minor);
    }
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
      folderId: null,
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

describe("folder field", () => {
  it("round-trips folderId through valuesFromReceipt and draftPatch", () => {
    const db = testDb();
    const folder = createFolder(db, { name: "Bali trip", kind: "trip" });
    const r = createReceipt(db, {
      status: "confirmed",
      merchant: "Toko Maju",
      purchasedAtLocal: "2026-11-03T10:15:00",
      purchasedTz: "Asia/Jakarta",
      purchasedAtUtc: Date.UTC(2026, 10, 3, 3, 15),
      scannedAtUtc: Date.UTC(2026, 10, 5, 5, 0),
      scannedTz: "Asia/Jakarta",
      currency: "IDR",
      totalMinor: 2500000,
      taxMinor: null,
      homeCurrencyAtSave: "IDR",
      parseSource: "manual",
      folderId: folder.id,
    });
    const cache = { base: "idr", latestDate: null, fetchedAt: null, byDate: {} };
    const v = valuesFromReceipt(r);
    expect(v.folderId).toBe(folder.id);
    expect(draftPatch(r, v, "IDR", cache).folderId).toBe(folder.id);
    expect(draftPatch(r, { ...v, folderId: null }, "IDR", cache).folderId).toBeNull();
  });
});

describe("valuesFromReceipt in the app language", () => {
  it("shows a Spanish receipt's total and tax with a comma", () => {
    const db = testDb();
    const r = createReceipt(db, {
      status: "draft",
      merchant: "Frutería La Huerta",
      purchasedAtLocal: "2026-11-24T19:20:00",
      purchasedAtUtc: 0,
      scannedAtUtc: 0,
      currency: "EUR",
      totalMinor: 2345,
      taxMinor: 90,
      parseSource: "heuristic",
    });
    expect(valuesFromReceipt(r, "es")).toMatchObject({ total: "23,45", tax: "0,90" });
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
