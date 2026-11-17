import { activeFilterCount, EMPTY_SEARCH, toFilter, type SearchState } from "./filterState";

const TODAY = "2026-11-07";
const HOME = "IDR";
const s = (p: Partial<SearchState>): SearchState => ({ ...EMPTY_SEARCH, ...p });

describe("toFilter", () => {
  it("maps presets to inclusive ranges", () => {
    expect(toFilter(s({ preset: "thisMonth" }), TODAY, 1, HOME)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(toFilter(s({ preset: "lastMonth" }), TODAY, 1, HOME)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(toFilter(s({ preset: "thisTaxYear" }), TODAY, 1, HOME)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(toFilter(s({ preset: "lastTaxYear" }), TODAY, 4, HOME)).toEqual({ from: "2025-04-01", to: "2026-03-31" });
  });

  it("last month in January is December of the previous year", () => {
    expect(toFilter(s({ preset: "lastMonth" }), "2026-01-15", 1, HOME)).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("custom passes bounds through and drops an empty one", () => {
    expect(toFilter(s({ preset: "custom", from: "2026-02-01", to: "2026-02-10" }), TODAY, 1, HOME)).toEqual({
      from: "2026-02-01",
      to: "2026-02-10",
    });
    expect(toFilter(s({ preset: "custom", from: "2026-02-01" }), TODAY, 1, HOME)).toEqual({ from: "2026-02-01" });
    expect(toFilter(s({ preset: "custom", to: "2026-02-10" }), TODAY, 1, HOME)).toEqual({ to: "2026-02-10" });
  });

  it("all sets no bounds, even with stale custom dates", () => {
    expect(toFilter(s({ from: "2026-02-01" }), TODAY, 1, HOME)).toEqual({});
  });

  it("carries text, categories, folder and currency; blank text is dropped; null folder kept", () => {
    expect(toFilter(s({ text: "  " }), TODAY, 1, HOME)).toEqual({});
    expect(toFilter(s({ text: "indo", categoryIds: ["a"], folderId: null, currency: "EUR" }), TODAY, 1, HOME)).toEqual({
      text: "indo",
      categoryIds: ["a"],
      folderId: null,
      currency: "EUR",
    });
  });

  it("unconverted maps to unconvertedFor home", () => {
    expect(toFilter(s({ unconverted: true }), TODAY, 1, "IDR")).toEqual({ unconvertedFor: "IDR" });
    expect(toFilter(s({ unconverted: false }), TODAY, 1, "IDR")).toEqual({});
  });
});

describe("activeFilterCount", () => {
  it("counts preset, categories (as one), folder and currency; not text", () => {
    expect(activeFilterCount(s({ text: "x" }))).toBe(0);
    expect(activeFilterCount(s({ preset: "thisMonth", categoryIds: ["a", "b"], folderId: null, currency: "EUR" }))).toBe(4);
    expect(activeFilterCount(s({ folderId: "f1" }))).toBe(1);
  });

  it("unconverted counts as an active filter", () => {
    expect(activeFilterCount(s({ unconverted: true }))).toBe(1);
  });
});
