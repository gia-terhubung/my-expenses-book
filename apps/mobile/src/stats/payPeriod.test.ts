import { lastPayPeriods, payPeriodOf, previousPayPeriod } from "./payPeriod";

describe("payPeriodOf", () => {
  it.each([
    ["2026-11-20", 1, { from: "2026-11-01", to: "2026-11-30", label: "2026-11" }],
    ["2026-11-20", 25, { from: "2026-10-25", to: "2026-11-24", label: "2026-11" }],
    ["2026-11-25", 25, { from: "2026-11-25", to: "2026-12-24", label: "2026-12" }],
    ["2026-11-20", 15, { from: "2026-11-15", to: "2026-12-14", label: "2026-11" }],
    ["2026-11-20", 16, { from: "2026-11-16", to: "2026-12-15", label: "2026-12" }],
    ["2027-01-03", 28, { from: "2026-12-28", to: "2027-01-27", label: "2027-01" }],
  ])("%s start %i", (date, startDay, expected) => {
    expect(payPeriodOf(date, startDay)).toEqual(expected);
  });

  it("handles leap year", () => {
    expect(payPeriodOf("2028-02-28", 1).to).toBe("2028-02-29");
  });
});

describe("previousPayPeriod", () => {
  it("steps back one period", () => {
    expect(previousPayPeriod(payPeriodOf("2026-11-20", 25), 25)).toEqual({
      from: "2026-09-25",
      to: "2026-10-24",
      label: "2026-10",
    });
  });
});

describe("lastPayPeriods", () => {
  it("returns n periods oldest first", () => {
    expect(lastPayPeriods("2026-11-20", 3, 25).map((p) => p.label)).toEqual([
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
  });
});
