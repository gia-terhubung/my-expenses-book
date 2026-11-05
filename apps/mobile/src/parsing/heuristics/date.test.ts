import { dateOrderFor, findDates } from "./date";

const today = new Date(2026, 10, 5);
const dmy = { order: "DMY" as const, today };
const mdy = { order: "MDY" as const, today };

describe("dateOrderFor", () => {
  it("maps currencies", () => {
    expect(dateOrderFor("USD")).toBe("MDY");
    for (const c of ["JPY", "CNY", "KRW", "TWD"]) expect(dateOrderFor(c)).toBe("YMD");
    expect(dateOrderFor("IDR")).toBe("DMY");
    expect(dateOrderFor("EUR")).toBe("DMY");
  });
});

const cases: [string, string, string | null][] = [
  ["16 Okt 2026", "2026-10-16", null],
  ["01 Nov 2026 • 14:09:33 WIB", "2026-11-01", "14:09"],
  ["29.09.26-20:26", "2026-09-29", "20:26"],
  ["05-11-2026", "2026-11-05", null],
  ["1 Oktober 2026, 13:29 WIB", "2026-10-01", "13:29"],
  ["27 Sep 2026, 13.41", "2026-09-27", "13:41"],
  ["Oct 16, 2026", "2026-10-16", null],
  ["2026-10-16", "2026-10-16", null],
  ["2026/10/16", "2026-10-16", null],
  ["16/10/2026", "2026-10-16", null],
  ["16 de octubre de 2026", "2026-10-16", null],
  ["16 Agu 2026 Jam 09.05", "2026-08-16", "09:05"],
  ["16 de março de 2026", "2026-03-16", null],
  ["16 février 2026", "2026-02-16", null],
  ["16. März 2026", "2026-03-16", null],
  ["10/14/2026  3:42 PM", "2026-10-14", "15:42"],
  ["2026年10月08日(木) 12:04", "2026-10-08", "12:04"],
];

describe("findDates", () => {
  it.each(cases)("%s", (line, date, time) => {
    const r = findDates(line, { order: "DMY", today });
    expect(r).toHaveLength(1);
    expect(r[0]!.date).toBe(date);
    expect(r[0]!.time).toBe(time);
  });

  it("day-first for IDR", () => {
    expect(findDates("04/11/26", dmy)[0]!.date).toBe("2026-11-04");
  });

  it("month-first for USD", () => {
    expect(findDates("04/11/26", mdy)[0]!.date).toBe("2026-04-11");
  });

  it("YMD honors 2-digit year-first", () => {
    const r = findDates("26/10/16", { order: "YMD", today });
    expect(r[0]!.date).toBe("2026-10-16");
  });

  it("future date low confidence", () => {
    const r = findDates("20/12/2026", dmy);
    expect(r[0]!.date).toBe("2026-12-20");
    expect(r[0]!.confidence).toBeLessThanOrEqual(0.3);
  });

  it("far-past 2-digit year is low confidence", () => {
    const r = findDates("27 SEP. 20", dmy);
    expect(r[0]!.date).toBe("2020-09-27");
    expect(r[0]!.confidence).toBeLessThanOrEqual(0.5);
  });

  it("does not turn an amount after a date into a time", () => {
    expect(findDates("16/10/2026 24.000", dmy)[0]!.time).toBeNull();
  });

  it("reports the end of the date span including a trailing time", () => {
    const line = "27 Sep 2026, 13.41 Rp 5.000";
    const r = findDates(line, dmy)[0]!;
    expect(line.slice(r.start, r.end)).toBe("27 Sep 2026, 13.41");
  });

  it("rejects impossible dates and bare amounts", () => {
    expect(findDates("31/02/2026", dmy)).toEqual([]);
    expect(findDates("TOTAL 24.000", dmy)).toEqual([]);
  });
});
