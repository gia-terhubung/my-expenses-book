
import { dateToLocalString, localStringToDate, utcDateToString, stringToUtcDate } from "./dateString";

describe("dateString", () => {
  it("TZ override took effect (CEST, UTC+2)", () => {
    expect(new Date(2026, 2, 29, 12).getTimezoneOffset()).toBe(-120);
  });

  it("round-trips the Europe/Paris DST-change date", () => {
    const d = localStringToDate("2026-03-29");
    expect(d.getHours()).toBe(12);
    expect(dateToLocalString(d)).toBe("2026-03-29");
  });

  it("round-trips days around the DST changes", () => {
    for (const s of ["2026-03-28", "2026-03-30", "2026-10-25", "2026-12-31", "2026-01-01"]) {
      expect(dateToLocalString(localStringToDate(s))).toBe(s);
    }
  });

  it("zero-pads and formats local components", () => {
    expect(dateToLocalString(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("falls back to a valid date for garbage input", () => {
    expect(Number.isNaN(localStringToDate("").getTime())).toBe(false);
  });

  it("UTC variants (Android picker works in UTC midnight) round-trip", () => {
    const d = stringToUtcDate("2026-03-29");
    expect(d.toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(utcDateToString(d)).toBe("2026-03-29");
  });
});
