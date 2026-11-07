import type { Receipt } from "@/db/types";

import { homeLine, monthLabel, totalLine } from "./format";

const row = (over: Partial<Receipt>): Receipt =>
  ({
    currency: "USD",
    totalMinor: 1000,
    amountHomeMinor: 17000000,
    homeCurrencyAtSave: "IDR",
    fxApproximate: false,
    ...over,
  }) as Receipt;

describe("format", () => {
  it("monthLabel names month and year", () => {
    const s = monthLabel("2026-11", "en");
    expect(s).toContain("November");
    expect(s).toContain("2026");
  });

  it("homeLine is null for same currency", () => {
    expect(homeLine(row({ currency: "IDR" }), "IDR", "en")).toBeNull();
  });

  it("homeLine converted, exact", () => {
    const s = homeLine(row({}), "IDR", "en")!;
    expect(s.startsWith("≈")).toBe(false);
    expect(s).toContain("170");
  });

  it("homeLine prefixes ≈ when approximate", () => {
    expect(
      homeLine(row({ fxApproximate: true }), "IDR", "en")!.startsWith("≈ "),
    ).toBe(true);
  });

  it("homeLine is — when unconverted or other home", () => {
    expect(homeLine(row({ amountHomeMinor: null }), "IDR", "en")).toBe("—");
    expect(homeLine(row({ homeCurrencyAtSave: "EUR" }), "IDR", "en")).toBe("—");
  });

  it("totalLine appends the not-converted note", () => {
    const s = totalLine(
      { homeMinor: 180000, count: 4, unconverted: 2 },
      "IDR",
      "en",
      (n) => `${n} not converted`,
    );
    expect(s).toContain("2 not converted");
    expect(
      totalLine(
        { homeMinor: 0, count: 0, unconverted: 0 },
        "IDR",
        "en",
        (n) => `${n} x`,
      ),
    ).not.toContain("x");
  });
});
