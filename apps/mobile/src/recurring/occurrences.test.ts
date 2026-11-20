import { dueOccurrences, nextOccurrence, todayIn, type RuleTiming } from "./occurrences";

const base: RuleTiming = {
  frequency: "monthly",
  anchorDate: "2026-01-05",
  monthDay: 5,
  endDate: null,
  paused: false,
  lastGeneratedDate: null,
};

describe("dueOccurrences", () => {
  it("monthly last day (-1) follows month length", () => {
    const r = { ...base, monthDay: -1, anchorDate: "2026-01-01" };
    expect(dueOccurrences(r, "2026-02-28")).toEqual(["2026-01-31", "2026-02-28"]);
    const leap = { ...base, monthDay: -1, anchorDate: "2028-02-01" };
    expect(dueOccurrences(leap, "2028-02-29")).toEqual(["2028-02-29"]);
  });

  it("monthly continues after lastGeneratedDate", () => {
    const r = { ...base, lastGeneratedDate: "2026-03-05" };
    expect(dueOccurrences(r, "2026-06-10")).toEqual(["2026-04-05", "2026-05-05", "2026-06-05"]);
  });

  it("monthly with null last starts at first match on or after anchor, anchor inclusive", () => {
    expect(dueOccurrences(base, "2026-03-04")).toEqual(["2026-01-05", "2026-02-05"]);
    const late = { ...base, anchorDate: "2026-01-20" };
    expect(dueOccurrences(late, "2026-03-10")).toEqual(["2026-02-05", "2026-03-05"]);
  });

  it("weekly from anchor weekday", () => {
    const r: RuleTiming = { ...base, frequency: "weekly", anchorDate: "2026-11-02", monthDay: null };
    expect(dueOccurrences(r, "2026-11-20")).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
  });

  it("yearly 29 Feb falls back to 28 Feb in non-leap years", () => {
    const r: RuleTiming = {
      ...base,
      frequency: "yearly",
      anchorDate: "2024-02-29",
      monthDay: null,
      lastGeneratedDate: "2024-02-29",
    };
    expect(dueOccurrences(r, "2027-03-01")).toEqual(["2025-02-28", "2026-02-28", "2027-02-28"]);
    expect(dueOccurrences(r, "2028-02-29").slice(-1)).toEqual(["2028-02-29"]);
  });

  it("endDate cuts the list (inclusive)", () => {
    const r = { ...base, lastGeneratedDate: "2026-03-05", endDate: "2026-05-31" };
    expect(dueOccurrences(r, "2026-06-10")).toEqual(["2026-04-05", "2026-05-05"]);
    expect(dueOccurrences({ ...r, endDate: "2026-05-05" }, "2026-06-10")).toEqual(["2026-04-05", "2026-05-05"]);
    expect(dueOccurrences({ ...r, endDate: "2026-05-04" }, "2026-06-10")).toEqual(["2026-04-05"]);
  });

  it("paused yields nothing", () => {
    expect(dueOccurrences({ ...base, paused: true }, "2026-06-10")).toEqual([]);
  });

  it("includes an occurrence on today, excludes it the day before", () => {
    const r = { ...base, lastGeneratedDate: "2026-03-05" };
    expect(dueOccurrences(r, "2026-04-05")).toEqual(["2026-04-05"]);
    expect(dueOccurrences(r, "2026-04-04")).toEqual([]);
  });

  it("today before anchor yields nothing", () => {
    expect(dueOccurrences(base, "2026-01-04")).toEqual([]);
  });
});

describe("nextOccurrence", () => {
  it("is strictly after the given date", () => {
    expect(nextOccurrence(base, "2026-06-05")).toBe("2026-07-05");
    expect(nextOccurrence(base, "2026-06-04")).toBe("2026-06-05");
  });

  it("is the anchor when asked before it", () => {
    expect(nextOccurrence(base, "2025-01-01")).toBe("2026-01-05");
  });

  it("is null past endDate", () => {
    expect(nextOccurrence({ ...base, endDate: "2026-06-30" }, "2026-06-05")).toBeNull();
  });

  it("handles weekly and yearly", () => {
    const w: RuleTiming = { ...base, frequency: "weekly", anchorDate: "2026-11-02", monthDay: null };
    expect(nextOccurrence(w, "2026-11-16")).toBe("2026-11-23");
    const y: RuleTiming = { ...base, frequency: "yearly", anchorDate: "2024-02-29", monthDay: null };
    expect(nextOccurrence(y, "2026-02-28")).toBe("2027-02-28");
    expect(nextOccurrence(y, "2027-02-28")).toBe("2028-02-29");
  });
});

describe("todayIn", () => {
  it("uses the zone's wall date", () => {
    expect(todayIn("Asia/Jakarta", new Date("2026-11-30T18:00:00Z"))).toBe("2026-12-01");
    expect(todayIn("Pacific/Pago_Pago", new Date("2026-12-01T05:00:00Z"))).toBe("2026-11-30");
  });
});
