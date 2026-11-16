import { formatMoney } from "@/money/money";

import { slipAmountText } from "./slipAmount";

describe("slipAmountText", () => {
  it("Rp 198.238.841 stays full", () => {
    const r = slipAmountText(19_823_884_100, "IDR", "id");
    expect(r).toEqual({ text: formatMoney(19_823_884_100, "IDR", "id"), exact: formatMoney(19_823_884_100, "IDR", "id"), compact: false });
    expect(r.text).toContain("198.238.841");
  });

  it("IDR 10^12 major switches to compact and keeps exact", () => {
    const r = slipAmountText(10 ** 14, "IDR", "id");
    expect(r.compact).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(12);
    expect(r.exact).toBe(formatMoney(10 ** 14, "IDR", "id"));
    expect(r.exact).toContain("1.000.000.000.000");
  });

  // "¥123,456,789,012" is exactly 16 characters, the default maxChars, so it is still full.
  it("JPY ¥123,456,789,012 (16 chars) stays full at the default maxChars", () => {
    const r = slipAmountText(123_456_789_012, "JPY", "en");
    expect(r.text).toBe("¥123,456,789,012");
    expect(r.compact).toBe(false);
  });

  it("JPY ¥1,234,567,890,123 (17 chars) switches to compact", () => {
    const r = slipAmountText(1_234_567_890_123, "JPY", "en");
    expect(r.compact).toBe(true);
    expect(r.text).not.toContain("1,234,567,890,123");
    expect(r.exact).toBe("¥1,234,567,890,123");
  });
});
