import {
  buildCopyText,
  formatRow,
  medianMs,
  summarize,
  type CheckRow,
} from "./checkReport";

const rows: CheckRow[] = [
  { n: 1, total: "12.50 USD", date: "2026-11-03", ms: 900, rotation: 0 },
  {
    n: 2,
    total: null,
    date: "2026-11-04",
    ms: 1500,
    rotation: 90,
    segments: 2,
  },
  { n: 3, total: "50000 IDR", date: null, ms: 2100, rotation: 0 },
  { n: 4, total: null, date: null, ms: 0, rotation: 0, error: true },
];

describe("checkReport", () => {
  it("formats a row with amount, date, ms, rotation only", () => {
    expect(formatRow(rows[0])).toBe(
      "#1: total 12.50 USD · date 2026-11-03 · 900 ms · rot 0",
    );
  });
  it("uses an em dash for missing values and notes splits", () => {
    expect(formatRow(rows[1])).toBe(
      "#2: total — · date 2026-11-04 · 1500 ms · rot 90 · split 2",
    );
  });
  it("marks errors without detail", () => {
    expect(formatRow(rows[3])).toBe("#4: ERROR");
  });
  it("median handles odd, even, empty", () => {
    expect(medianMs([3, 1, 2])).toBe(2);
    expect(medianMs([1, 2, 3, 4])).toBe(3);
    expect(medianMs([])).toBe(0);
  });
  it("summary counts found fields and excludes errors from timing", () => {
    expect(summarize(rows)).toBe(
      "photos 4 · totals found 2 · dates found 2 · median 1500 ms · max 2100 ms · errors 1",
    );
  });
  it("copy text is summary then rows", () => {
    const lines = buildCopyText(rows).split("\n");
    expect(lines).toHaveLength(5);
    expect(lines[0]).toMatch(/^photos 4/);
  });
});
