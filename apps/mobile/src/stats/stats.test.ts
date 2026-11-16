import { categoryStrip, lastMonths, pacePercent, pacePeriods, taxYearMonths, taxYearPacePeriods } from "./stats";

const row = (categoryId: string | null, homeMinor: number) => ({
  categoryId,
  total: { homeMinor, count: 1, unconverted: 0 },
});

describe("pacePeriods", () => {
  it("clamps previous range to the last day of a shorter previous month", () => {
    expect(pacePeriods("2026-03-31")).toEqual({
      current: { from: "2026-03-01", to: "2026-03-31" },
      previous: { from: "2026-02-01", to: "2026-02-28" },
      previousMonth: "2026-02",
    });
  });
  it("uses the leap day", () => {
    expect(pacePeriods("2024-03-30").previous.to).toBe("2024-02-29");
  });
  it("wraps January to the previous December", () => {
    const p = pacePeriods("2026-01-15");
    expect(p.previous).toEqual({ from: "2025-12-01", to: "2025-12-15" });
    expect(p.previousMonth).toBe("2025-12");
  });
});

describe("taxYearPacePeriods", () => {
  it("compares the same date in the previous tax year", () => {
    expect(taxYearPacePeriods("2026-06-10", 4)).toEqual({
      current: { from: "2026-04-01", to: "2026-06-10" },
      previous: { from: "2025-04-01", to: "2025-06-10" },
      previousMonth: "2025-04",
    });
  });
  it("handles a start month later than today's month and a leap day", () => {
    const p = taxYearPacePeriods("2026-02-10", 4);
    expect(p.current.from).toBe("2025-04-01");
    expect(p.previous).toEqual({ from: "2024-04-01", to: "2025-02-10" });
    expect(taxYearPacePeriods("2024-02-29", 4).previous.to).toBe("2023-02-28");
  });
});

describe("pacePercent", () => {
  it("is null without a previous amount", () => expect(pacePercent(1200, 0)).toBeNull());
  it("rounds to a whole percent", () => {
    expect(pacePercent(1120, 1000)).toBe(12);
    expect(pacePercent(500, 1000)).toBe(-50);
    expect(pacePercent(1005, 1000)).toBe(1);
  });
});

describe("categoryStrip", () => {
  it("never puts default:other or null in the top slots", () => {
    const s = categoryStrip([
      row("default:other", 900),
      row(null, 800),
      row("a", 70),
      row("b", 60),
      row("c", 50),
      row("d", 40),
    ]);
    expect(s.map((x) => x.categoryId)).toEqual(["a", "b", "c", "rest"]);
    expect(s.reduce((n, x) => n + x.share, 0)).toBeCloseTo(1, 10);
    expect(s[3]!.share).toBeCloseTo((900 + 800 + 40) / 1920, 10);
  });
  it("returns [] for a single category or a zero total", () => {
    expect(categoryStrip([row("a", 100)])).toEqual([]);
    expect(categoryStrip([row("a", 0), row("b", 0)])).toEqual([]);
    expect(categoryStrip([])).toEqual([]);
  });
  it("ignores categories without a converted amount", () => {
    expect(categoryStrip([row("a", 100), row("b", 0)])).toEqual([]);
  });
  it("omits an empty rest and keeps two categories", () => {
    expect(categoryStrip([row("a", 75), row("b", 25)])).toEqual([
      { categoryId: "a", share: 0.75 },
      { categoryId: "b", share: 0.25 },
    ]);
  });
});

describe("month lists", () => {
  it("lastMonths is oldest first and crosses years", () => {
    expect(lastMonths("2026-02-10", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("taxYearMonths begins at the start month", () => {
    const m = taxYearMonths(2026, 4);
    expect(m).toHaveLength(12);
    expect(m[0]).toBe("2026-04");
    expect(m[11]).toBe("2027-03");
    expect(taxYearMonths(2026, 1)[11]).toBe("2026-12");
  });
});
