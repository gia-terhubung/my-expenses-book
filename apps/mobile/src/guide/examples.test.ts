import { payCycleExample, taxYearExample } from "./examples";

const dm = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });
const dmy = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const f = (d: string) => dm.format(new Date(`${d}T00:00:00Z`));
const fy = (d: string) => dmy.format(new Date(`${d}T00:00:00Z`));

describe("payCycleExample", () => {
  it("day 25 on Nov 23 runs Oct 25 – Nov 24", () => {
    expect(payCycleExample("2026-11-23", 25, "en")).toBe(`${f("2026-10-25")} – ${f("2026-11-24")}`);
  });
  it("crosses the year end", () => {
    expect(payCycleExample("2026-12-28", 25, "en")).toBe(`${f("2026-12-25")} – ${f("2027-01-24")}`);
  });
  it("day 1 is the calendar month", () => {
    expect(payCycleExample("2026-11-23", 1, "en")).toBe(`${f("2026-11-01")} – ${f("2026-11-30")}`);
  });
});

describe("taxYearExample", () => {
  it("April start: label 2026/27, 1 Apr 2026 – 31 Mar 2027", () => {
    expect(taxYearExample("2026-11-23", 4, "en")).toEqual({
      label: "2026/27",
      range: `${fy("2026-04-01")} – ${fy("2027-03-31")}`,
    });
  });
  it("January start: label 2026", () => {
    expect(taxYearExample("2026-11-23", 1, "en").label).toBe("2026");
  });
});
