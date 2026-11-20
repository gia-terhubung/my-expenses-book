import { addDays, daysInMonth, fromDayNumber, pad2, toDayNumber, ymd } from "./civil";

describe("civil dates", () => {
  it("pads and formats", () => {
    expect(pad2(3)).toBe("03");
    expect(ymd(2026, 1, 5)).toBe("2026-01-05");
  });

  it("knows month lengths incl. leap years", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it("round-trips day numbers", () => {
    expect(toDayNumber("1970-01-01")).toBe(0);
    expect(fromDayNumber(toDayNumber("2028-02-29"))).toBe("2028-02-29");
    expect(fromDayNumber(toDayNumber("1969-12-31"))).toBe("1969-12-31");
  });

  it("adds days across month, year and leap boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-11-02", 7)).toBe("2026-11-09");
  });
});
