import { toMinor } from "@/money/money";

import { AI_PARSING_ENABLED } from "./flags";
import { parseReceipt, type ReceiptAILike } from "./index";

const hints = { homeCurrency: "IDR", locale: "id-ID", today: new Date(2026, 10, 5) };
const lines = ["Kopi Kenangan", "02 Nov 2026 10:15", "Total Rp 96.000"];

const fakeAi = (over: Partial<ReceiptAILike> = {}) => {
  const ai = {
    getAvailability: jest.fn().mockResolvedValue({ available: true, engine: "gemini_nano" }),
    parseReceipt: jest.fn().mockResolvedValue('{"merchant":"Kopi Kenangan","total":"96000","currency":"IDR"}'),
    ...over,
  };
  return ai as ReceiptAILike & { getAvailability: jest.Mock; parseReceipt: jest.Mock };
};

describe("parseReceipt", () => {
  it("ships with the flag off", () => {
    expect(AI_PARSING_ENABLED).toBe(false);
  });
  it("never touches ai while flag is false", async () => {
    const ai = fakeAi();
    const r = await parseReceipt(lines, hints, ai);
    expect(ai.getAvailability).not.toHaveBeenCalled();
    expect(ai.parseReceipt).not.toHaveBeenCalled();
    expect(r.source).toBe("heuristic");
    expect(r.totalMinor).toBe(toMinor("96000", "IDR"));
  });
  it("merges when forced on and available", async () => {
    const ai = fakeAi();
    const r = await parseReceipt(lines, hints, ai, { aiEnabled: true });
    expect(ai.parseReceipt).toHaveBeenCalledTimes(1);
    expect(r.confidence.total).toBe(0.95);
  });
  it("skips LLM when unavailable", async () => {
    const ai = fakeAi({ getAvailability: jest.fn().mockResolvedValue({ available: false, engine: null }) });
    const r = await parseReceipt(lines, hints, ai, { aiEnabled: true });
    expect(ai.parseReceipt).not.toHaveBeenCalled();
    expect(r.source).toBe("heuristic");
  });
  it("falls back on reject", async () => {
    const ai = fakeAi({ parseReceipt: jest.fn().mockRejectedValue(new Error("boom")) });
    const r = await parseReceipt(lines, hints, ai, { aiEnabled: true });
    expect(r.source).toBe("heuristic");
    expect(r.totalMinor).toBe(toMinor("96000", "IDR"));
  });
  it("falls back on timeout", async () => {
    const ai = fakeAi({ parseReceipt: jest.fn().mockReturnValue(new Promise(() => {})) });
    const r = await parseReceipt(lines, hints, ai, { aiEnabled: true, timeoutMs: 20 });
    expect(r.source).toBe("heuristic");
  });
  it("falls back on garbage output", async () => {
    const ai = fakeAi({ parseReceipt: jest.fn().mockResolvedValue("nope") });
    const r = await parseReceipt(lines, hints, ai, { aiEnabled: true });
    expect(r.source).toBe("heuristic");
  });
});
