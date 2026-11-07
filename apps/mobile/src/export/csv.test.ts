import { toCsv, CSV_COLUMNS } from "./csv";
import type { ExportRow } from "./rows";

function row(over: Partial<ExportRow> = {}): ExportRow {
  return {
    id: "id1",
    date: "2026-03-01",
    time: "10:00",
    timezone: "Asia/Jakarta",
    merchant: "Toko",
    category: "Food",
    folder: "",
    currency: "IDR",
    total: "12500",
    tax: "",
    homeCurrency: "",
    homeAmount: "",
    fxRate: "",
    fxRateDate: "",
    fxApproximate: false,
    notes: "",
    refNo: "",
    receipt: {} as ExportRow["receipt"],
    ...over,
  };
}
const header = (c: keyof ExportRow) => `H_${c}`;
const lines = (s: string) => s.slice(1).split("\r\n");

describe("toCsv", () => {
  it("starts with BOM, uses CRLF, header in column order", () => {
    const out = toCsv([row()], header);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out.endsWith("\r\n")).toBe(true);
    const l = lines(out);
    expect(l[0]).toBe(CSV_COLUMNS.map(header).join(","));
    expect(l).toHaveLength(3);
    expect(l[1]).toBe("2026-03-01,10:00,Asia/Jakarta,Toko,Food,,IDR,12500,,,,,,,,,id1");
  });

  it("column order is fixed", () => {
    expect([...CSV_COLUMNS]).toEqual([
      "date","time","timezone","merchant","category","folder","currency","total","tax",
      "homeCurrency","homeAmount","fxRate","fxRateDate","fxApproximate","notes","refNo","id",
    ]);
  });

  it("quotes commas and quotes, keeps newlines", () => {
    const out = toCsv([row({ merchant: 'Café "Le, Nord"', notes: "a\nb" })], header);
    expect(out).toContain('"Café ""Le, Nord"""');
    expect(out).toContain('"a\nb"');
  });

  it.each(["=HYPERLINK(1)", "+1", "-1", "@x", "\tx", "\rx"])("guards text formula %j", (v) => {
    const out = toCsv([row({ merchant: v, category: v, folder: v, notes: v, refNo: v })], header);
    const body = out.slice(out.indexOf("\r\n") + 2);
    const needsQuote = /[",\r\n]/.test(`'${v}`);
    const cell = needsQuote ? `"'${v}"` : `'${v}`;
    expect(body.split(cell).length - 1).toBe(5);
  });

  it("does not prefix numeric columns", () => {
    const out = toCsv([row({ total: "-3.00", homeAmount: "-1" })], header);
    expect(lines(out)[1]).toContain(",-3.00,");
    expect(lines(out)[1]).not.toContain("'-");
  });

  it("writes fxApproximate as yes or empty", () => {
    expect(lines(toCsv([row({ fxApproximate: true })], header))[1].split(",")[13]).toBe("yes");
    expect(lines(toCsv([row({ fxApproximate: false })], header))[1].split(",")[13]).toBe("");
  });

  it("round-trips non-Latin text", () => {
    expect(toCsv([row({ merchant: "東京ラーメン" })], header)).toContain(",東京ラーメン,");
  });
});
