import { findAmounts } from "./amount";

const cases: [string, string, boolean][] = [
  ["Rp96.000", "96000", false],
  ["Rp 750.000", "750000", false],
  ["IDR 100,000.00", "100000", false],
  ["IDR 1,900,000", "1900000", false],
  ["RP  1, 000, 000. 00", "1000000", false],
  ["(8,000)", "8000", true],
  ["-Rp461.000", "461000", true],
  ["€12,50", "12.50", false],
  ["1.234,56 €", "1234.56", false],
  ["$1,234.56", "1234.56", false],
  ["R$ 1.234,56", "1234.56", false],
  ["¥1,280", "1280", false],
  ["24.000", "24000", false],
  ["12.5", "12.5", false],
];

describe("findAmounts", () => {
  it.each(cases)("%s -> %s", (line, value, negative) => {
    const r = findAmounts(line);
    expect(r).toHaveLength(1);
    expect(r[0]!.value).toBe(value);
    expect(r[0]!.negative).toBe(negative);
  });

  it("finds several amounts with positions", () => {
    const r = findAmounts("SUBTOTAL 36.77  TAX 0.70");
    expect(r.map((a) => a.value)).toEqual(["36.77", "0.70"]);
    expect(r[0]!.start).toBe(9);
  });

  it("hyphen separator is not a minus", () => {
    const r = findAmounts("Nasi - 24.000");
    expect(r).toHaveLength(1);
    expect(r[0]!.value).toBe("24000");
    expect(r[0]!.negative).toBe(false);
    expect(findAmounts("Nasi-24.000")[0]!.negative).toBe(false);
  });

  it.each(["-24.000", "Rp-5.000", "-Rp461.000"])("%s is negative", (l) => {
    expect(findAmounts(l)[0]!.negative).toBe(true);
  });

  it("does not join neighbouring amounts", () => {
    expect(findAmounts("Rp 10.000, 20.000").map((a) => a.value)).toEqual(["10000", "20000"]);
    expect(findAmounts("Qty 2, 3 items").map((a) => a.value)).toEqual(["2", "3"]);
    expect(findAmounts("1, 2, 3").map((a) => a.value)).toEqual(["1", "2", "3"]);
  });

  it("returns nothing for text without digits", () => {
    expect(findAmounts("TOTAL BELANJA")).toEqual([]);
  });
});
