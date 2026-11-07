import {
  taxYearLabel,
  taxYearOf,
  taxYearRange,
  taxYearsFromMonths,
} from "./taxYear";

describe("taxYearOf", () => {
  it("returns the year the tax year starts in", () => {
    expect(taxYearOf("2026-03-31", 4)).toBe(2025);
    expect(taxYearOf("2026-04-01", 4)).toBe(2026);
    expect(taxYearOf("2026-12-31", 1)).toBe(2026);
    expect(taxYearOf("2026-01-01", 1)).toBe(2026);
  });
});

describe("taxYearRange", () => {
  it("covers a calendar year when starting in January", () => {
    expect(taxYearRange(2026, 1)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("runs from the start month to the day before it a year later", () => {
    expect(taxYearRange(2026, 4)).toEqual({ from: "2026-04-01", to: "2027-03-31" });
  });

  it("uses the leap-day end date when February falls in the range", () => {
    expect(taxYearRange(2027, 3)).toEqual({ from: "2027-03-01", to: "2028-02-29" });
  });
});

describe("taxYearLabel", () => {
  it("is a single year when starting in January", () => {
    expect(taxYearLabel(2026, 1)).toBe("2026");
  });

  it("is a split year otherwise", () => {
    expect(taxYearLabel(2026, 7)).toBe("2026/27");
  });

  it("zero-pads the trailing year across a century boundary", () => {
    expect(taxYearLabel(2099, 4)).toBe("2099/00");
  });
});

describe("taxYearsFromMonths", () => {
  it("lists distinct tax years, newest first", () => {
    expect(taxYearsFromMonths(["2026-05", "2026-03", "2025-04"], 4)).toEqual([2026, 2025]);
  });

  it("collapses months that fall in the same tax year", () => {
    expect(taxYearsFromMonths(["2026-06", "2026-05", "2026-04", "2026-03"], 4)).toEqual([
      2026, 2025,
    ]);
  });

  it("returns an empty list for no months", () => {
    expect(taxYearsFromMonths([], 4)).toEqual([]);
  });
});
