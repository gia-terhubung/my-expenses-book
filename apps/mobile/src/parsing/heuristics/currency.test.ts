import { detectCurrency } from "./currency";

const cases: [string, string][] = [
  ["Rp 96.000", "IDR"],
  ["IDR 100,000.00", "IDR"],
  ["US$ 5.00", "USD"],
  ["TOTAL $37.47", "USD"],
  ["S$ 12.00", "SGD"],
  ["A$ 12.00", "AUD"],
  ["R$ 12,00", "BRL"],
  ["RM 12.00", "MYR"],
  ["€ 12,50", "EUR"],
  ["£3.20", "GBP"],
  ["¥1,280", "JPY"],
  ["1280円", "JPY"],
  ["฿ 120", "THB"],
  ["THB 120", "THB"],
  ["₫ 50.000", "VND"],
  ["VND 50.000", "VND"],
  ["Total EUR 12,50", "EUR"],
];

describe("detectCurrency", () => {
  it.each(cases)("%s -> %s", (text, code) => {
    const r = detectCurrency(text, "XXX");
    expect(r.code).toBe(code);
    expect(r.confidence).toBeGreaterThan(0);
  });

  it("falls back with confidence 0", () => {
    expect(detectCurrency("TOTAL 24.000", "IDR")).toEqual({ code: "IDR", confidence: 0 });
  });

  it("specific dollar beats bare $", () => {
    expect(detectCurrency("$ 5 S$ 6", "IDR").code).toBe("SGD");
  });

  it("a code next to a digit on a different line is not near (PLN electricity receipt)", () => {
    const text = [
      "RPTAG PLN : Rp 145.375",
      "ADMIN BANK : Rp 1.600",
      "TOTAL BAYAR : Rp 146.975",
      "PLN MENYATAKAN STRUK INI SBG BUKTI",
    ].join("\n");
    expect(detectCurrency(text, "IDR").code).toBe("IDR");
  });

  it("a code next to a digit on the same line still counts", () => {
    expect(detectCurrency("TOTAL 146.975 PLN", "IDR").code).toBe("PLN");
  });
});
