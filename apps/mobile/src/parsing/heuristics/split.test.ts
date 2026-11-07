import { splitReceipts } from "./split";

const today = new Date(2026, 10, 5);

describe("splitReceipts", () => {
  it("splits two labels with repeated header and different totals", () => {
    const lines = [
      "SICEPAT EXPRESS",
      "KX4401928374",
      "TOTAL ONGKIR  IDR 18,000",
      "Ship: 04-11-2026",
      "SICEPAT EXPRESS",
      "KX4401928399",
      "TOTAL ONGKIR  IDR 25,000",
      "Ship: 04-11-2026",
    ];
    const r = splitReceipts(lines, { today });
    expect(r.reason).toBe("repeated-header");
    expect(r.segments).toEqual([lines.slice(0, 4), lines.slice(4)]);
  });

  it("does not split EDC slip over its POS receipt", () => {
    const lines = [
      "WARUNG SEDAP MALAM",
      "EDC BCA  SALE",
      "TOTAL  Rp. 85,000",
      "WARUNG SEDAP MALAM",
      "Nasi Goreng  45.000",
      "Es Teh  40.000",
      "Grand Total : 85.000",
    ];
    const r = splitReceipts(lines, { today });
    expect(r.reason).toBe("single");
    expect(r.segments).toEqual([lines]);
  });

  it("single when no header recurs", () => {
    expect(splitReceipts(["A SHOP", "TOTAL 5.000"], { today }).reason).toBe("single");
  });
});
