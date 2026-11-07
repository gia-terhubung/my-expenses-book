import { presetRange } from "./presets";

const today = "2026-11-07";
describe("presetRange", () => {
  it("this tax year", () => {
    expect(presetRange("thisTaxYear", today, 1)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(presetRange("thisTaxYear", today, 4)).toEqual({ from: "2026-04-01", to: "2027-03-31" });
  });
  it("this tax year before the start month belongs to the previous year", () => {
    expect(presetRange("thisTaxYear", "2026-02-10", 4)).toEqual({ from: "2025-04-01", to: "2026-03-31" });
  });
  it("last tax year", () => {
    expect(presetRange("lastTaxYear", today, 4)).toEqual({ from: "2025-04-01", to: "2026-03-31" });
  });
  it("months", () => {
    expect(presetRange("thisMonth", today, 1)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(presetRange("lastMonth", today, 1)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(presetRange("lastMonth", "2026-01-15", 1)).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(presetRange("thisMonth", "2028-02-15", 1)).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
  it("all and custom are open", () => {
    expect(presetRange("all", today, 1)).toEqual({});
    expect(presetRange("custom", today, 1)).toEqual({});
  });
});
