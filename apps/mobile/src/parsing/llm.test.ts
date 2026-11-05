import { toMinor } from "@/money/money";

import { mergeParsed, parseLlmOutput } from "./llm";
import type { ParsedReceipt } from "./types";

const today = new Date(2026, 10, 5);

const heur = (over: Partial<ParsedReceipt> = {}, conf: Partial<ParsedReceipt["confidence"]> = {}): ParsedReceipt => ({
  merchant: "Kopi",
  purchasedDate: "2026-11-02",
  purchasedTime: null,
  currency: "IDR",
  totalMinor: 96000,
  taxMinor: null,
  categoryId: null,
  refNo: null,
  confidence: { merchant: 0.9, date: 0.9, total: 0.9, tax: 0, currency: 0.9, category: 0, ...conf },
  source: "heuristic",
  ...over,
});

describe("parseLlmOutput", () => {
  it("accepts fenced JSON and normalizes fields", () => {
    const raw = '```json\n{"merchant":"Kopi Kenangan","purchasedAt":"2026-11-02T10:15:00","total":"96000","tax":"","currency":"idr"}\n```';
    expect(parseLlmOutput(raw, "IDR", today)).toEqual({
      merchant: "Kopi Kenangan",
      purchasedDate: "2026-11-02",
      purchasedTime: "10:15",
      totalMinor: toMinor("96000", "IDR"),
      currency: "IDR",
    });
  });
  it("extracts first object from prose", () => {
    const r = parseLlmOutput('Here: {"total":"12.50","currency":"USD"} done', "USD", today);
    expect(r?.totalMinor).toBe(1250);
  });
  it("rejects non-JSON and wrong shapes", () => {
    expect(parseLlmOutput("sorry I cannot", "IDR", today)).toBeNull();
    expect(parseLlmOutput('{"total":', "IDR", today)).toBeNull();
    expect(parseLlmOutput('{"merchant":42}', "IDR", today)).toBeNull();
  });
  it("rejects negative totals", () => {
    expect(parseLlmOutput('{"total":"-5000","currency":"IDR"}', "IDR", today)).toBeNull();
  });
  it("drops future-dated output", () => {
    const r = parseLlmOutput('{"merchant":"A","purchasedAt":"2027-05-01"}', "IDR", today);
    expect(r).toEqual({ merchant: "A" });
  });
  it("returns null when nothing valid", () => {
    expect(parseLlmOutput("{}", "IDR", today)).toBeNull();
  });
});

describe("mergeParsed", () => {
  it("returns heuristic untouched for null llm", () => {
    const h = heur();
    expect(mergeParsed(h, null)).toBe(h);
  });
  it("agree: total and date confidence 0.95, source stays heuristic", () => {
    const r = mergeParsed(heur(), { totalMinor: 96000, purchasedDate: "2026-11-02" });
    expect(r.confidence.total).toBe(0.95);
    expect(r.confidence.date).toBe(0.95);
    expect(r.source).toBe("heuristic");
  });
  it("disagree, strong heuristic: keeps heuristic", () => {
    const r = mergeParsed(heur(), { totalMinor: 50000, purchasedDate: "2026-10-01" });
    expect(r.totalMinor).toBe(96000);
    expect(r.purchasedDate).toBe("2026-11-02");
    expect(r.confidence.total).toBe(0.9);
    expect(r.source).toBe("heuristic");
  });
  it("disagree, weak heuristic: LLM at 0.5 and source = engine", () => {
    const r = mergeParsed(heur({}, { total: 0.6, date: 0.4 }), { totalMinor: 50000, purchasedDate: "2026-10-01" }, "apple_fm");
    expect(r.totalMinor).toBe(50000);
    expect(r.purchasedDate).toBe("2026-10-01");
    expect(r.confidence.total).toBe(0.5);
    expect(r.confidence.date).toBe(0.5);
    expect(r.source).toBe("apple_fm");
  });
  it("heuristic missing: LLM fills at 0.5", () => {
    const r = mergeParsed(
      heur({ totalMinor: null, purchasedDate: null }, { total: 0, date: 0 }),
      { totalMinor: 7000, purchasedDate: "2026-11-01" },
    );
    expect(r.totalMinor).toBe(7000);
    expect(r.purchasedDate).toBe("2026-11-01");
  });
  it("LLM wins merchant only when heuristic confidence < 0.6", () => {
    expect(mergeParsed(heur(), { merchant: "X" }).merchant).toBe("Kopi");
    const r = mergeParsed(heur({ merchant: null }, { merchant: 0.3 }), { merchant: "X" });
    expect(r.merchant).toBe("X");
    expect(r.source).toBe("gemini_nano");
  });
  it("currency mismatch counts as disagreement", () => {
    const r = mergeParsed(heur({}, { total: 0.5 }), { totalMinor: 96000, currency: "USD" });
    expect(r.currency).toBe("USD");
    expect(r.confidence.total).toBe(0.5);
  });
});
