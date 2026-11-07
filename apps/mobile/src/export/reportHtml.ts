import { listPages } from "../db/repositories/pages";
import {
  monthTotals,
  sumHome,
  type HomeTotal,
  type ReceiptFilter,
} from "../db/repositories/receiptQueries";
import type { AppDb } from "../db/types";
import type { ImageStore } from "../images/store";
import { formatMoney } from "../money/money";
import { homeLine, monthLabel, totalLine } from "../receipts/format";
import { loadExportRows, type ExportRow } from "./rows";

type T = (key: string, opts?: object) => string;

export type ReportInput = {
  title: string;
  rangeLabel: string;
  generatedAt: string;
  home: string;
  locale: string;
  total: HomeTotal;
  months: {
    label: string;
    total: HomeTotal;
    rows: { row: ExportRow; thumbDataUri: string | null }[];
  }[];
  byCategory: { label: string; homeMinor: number }[];
  t: (key: string, opts?: object) => string;
};

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const CSS = `
@page { margin: 16mm; }
body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 10pt; color: #1a1a1a; }
h1 { font-size: 18pt; margin: 0 0 4px; }
h2 { font-size: 12pt; margin: 18px 0 6px; }
.meta { color: #555; margin-bottom: 12px; }
.summary { border: 1px solid #ccc; border-radius: 6px; padding: 8px 12px; margin-bottom: 8px; }
.summary div { margin: 2px 0; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 9pt; color: #555; border-bottom: 1px solid #999; padding: 3px 4px; }
td { padding: 3px 4px; border-bottom: 1px solid #e3e3e3; vertical-align: middle; }
tr { break-inside: avoid; }
.num { text-align: right; white-space: nowrap; }
img { width: 48px; height: 48px; object-fit: cover; border-radius: 3px; }
`;

export function buildReportHtml(input: ReportInput): string {
  const { t, home, locale } = input;
  const notConverted = (n: number) => t("totals.notConverted", { count: n });
  const money = (minor: number, code: string) => formatMoney(minor, code, locale);

  const categoryRows = input.byCategory
    .map((c) => `<tr><td>${esc(c.label)}</td><td class="num">${esc(money(c.homeMinor, home))}</td></tr>`)
    .join("");

  const monthSections = input.months
    .map((m) => {
      const body = m.rows
        .map(({ row, thumbDataUri }) => {
          const r = row.receipt;
          const homeCell = homeLine(r, home, locale) ?? money(r.totalMinor, home);
          return `<tr>
<td>${thumbDataUri ? `<img src="${esc(thumbDataUri)}" alt="">` : ""}</td>
<td>${esc(row.date)}</td>
<td>${esc(row.merchant || t("receipts.unknownMerchant"))}</td>
<td>${esc(row.category)}</td>
<td class="num">${esc(money(r.totalMinor, r.currency))}</td>
<td class="num">${esc(homeCell)}</td>
</tr>`;
        })
        .join("\n");
      return `<h2>${esc(m.label)} · ${esc(totalLine(m.total, home, locale, notConverted))}</h2>
<table><thead><tr><th></th><th>${esc(t("export.report.date"))}</th><th>${esc(t("export.report.merchant"))}</th><th>${esc(t("export.report.category"))}</th><th class="num">${esc(t("export.report.amount"))}</th><th class="num">${esc(t("export.report.homeAmount"))}</th></tr></thead><tbody>
${body}
</tbody></table>`;
    })
    .join("\n");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(input.title)}</title><style>${CSS}</style></head>
<body>
<h1>${esc(input.title)}</h1>
<div class="meta">${esc(input.rangeLabel)} · ${esc(t("export.report.generated"))}: ${esc(input.generatedAt)} · ${esc(home)}</div>
<div class="summary">
<div><strong>${esc(t("export.report.total"))}:</strong> ${esc(money(input.total.homeMinor, home))}</div>
<div>${esc(t("export.report.receipts"))}: ${input.total.count}</div>
${input.total.unconverted > 0 ? `<div>${esc(notConverted(input.total.unconverted))}</div>` : ""}
</div>
<h2>${esc(t("export.report.byCategory"))}</h2>
<table><tbody>${categoryRows}</tbody></table>
${monthSections}
</body></html>`;
}

const toMonth = (row: ExportRow) => row.date.slice(0, 7);

export async function buildReportInput(deps: {
  db: AppDb;
  store: ImageStore;
  filter: ReceiptFilter;
  home: string;
  locale: string;
  t: T;
  includeThumbs: boolean;
  title: string;
  rangeLabel: string;
  now: Date;
}): Promise<ReportInput> {
  const { db, store, filter, home, locale, t } = deps;
  const rows = loadExportRows(db, filter, (c) =>
    c.customName ?? (c.nameKey ? t(`categories.${c.nameKey}`) : ""),
  );
  const totals = monthTotals(db, filter, home);

  const months: ReportInput["months"] = [];
  const byMonth = new Map<string, ReportInput["months"][number]>();
  const cats = new Map<string, number>();
  const uncategorized = t("export.report.uncategorized");
  for (const row of rows) {
    const key = toMonth(row);
    let m = byMonth.get(key);
    if (!m) {
      m = {
        label: monthLabel(key, locale),
        total: totals[key] ?? { homeMinor: 0, count: 0, unconverted: 0 },
        rows: [],
      };
      byMonth.set(key, m);
      months.push(m);
    }
    m.rows.push({ row, thumbDataUri: deps.includeThumbs ? await thumb(db, store, row.id) : null });
    const r = row.receipt;
    if (r.homeCurrencyAtSave === home && r.amountHomeMinor != null) {
      const label = row.category || uncategorized;
      cats.set(label, (cats.get(label) ?? 0) + r.amountHomeMinor);
    }
  }
  const byCategory = [...cats].map(([label, homeMinor]) => ({ label, homeMinor }))
    .sort((a, b) => b.homeMinor - a.homeMinor);

  return {
    title: deps.title,
    rangeLabel: deps.rangeLabel,
    generatedAt: deps.now.toISOString().slice(0, 10),
    home,
    locale,
    total: sumHome(db, filter, home),
    months,
    byCategory,
    t,
  };
}

async function thumb(db: AppDb, store: ImageStore, receiptId: string): Promise<string | null> {
  const page = listPages(db, receiptId)[0];
  if (!page?.thumbPath) return null;
  try {
    const bytes = await store.readPlain(page.thumbPath);
    return `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return null;
  }
}
