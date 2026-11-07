import type { ExportRow } from "./rows";

export const CSV_COLUMNS: readonly (keyof ExportRow)[] = [
  "date", "time", "timezone", "merchant", "category", "folder", "currency", "total", "tax",
  "homeCurrency", "homeAmount", "fxRate", "fxRateDate", "fxApproximate", "notes", "refNo", "id",
];

/** Free-text columns get the spreadsheet formula guard; numeric columns never do. */
const TEXT_COLUMNS = new Set<keyof ExportRow>(["merchant", "category", "folder", "notes", "refNo"]);

function guard(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

function quote(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function cell(row: ExportRow, col: keyof ExportRow): string {
  if (col === "fxApproximate") return row.fxApproximate ? "yes" : "";
  const v = String(row[col] ?? "");
  return quote(TEXT_COLUMNS.has(col) ? guard(v) : v);
}

/** UTF-8 BOM, CRLF, RFC 4180 quoting. */
export function toCsv(rows: ExportRow[], header: (col: keyof ExportRow) => string): string {
  const lines = [CSV_COLUMNS.map((c) => quote(header(c))).join(",")];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => cell(r, c)).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
