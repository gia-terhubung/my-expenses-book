import { listCategories } from "../db/repositories/categories";
import { listFolders } from "../db/repositories/folders";
import { listReceipts, type ReceiptCursor, type ReceiptFilter } from "../db/repositories/receiptQueries";
import type { AppDb, Category, Receipt } from "../db/types";
import { fromMinor } from "../money/money";

export type ExportRow = {
  id: string;
  /** YYYY-MM-DD, wall clock. */
  date: string;
  /** HH:mm or "". */
  time: string;
  timezone: string;
  merchant: string;
  category: string;
  folder: string;
  currency: string;
  total: string;
  tax: string;
  homeCurrency: string;
  homeAmount: string;
  fxRate: string;
  fxRateDate: string;
  fxApproximate: boolean;
  notes: string;
  refNo: string;
  receipt: Receipt;
};

const CHUNK = 500;

/** Confirmed live receipts matching the filter, newest first. Deleted category/folder resolve to "". */
export function loadExportRows(
  db: AppDb,
  filter: ReceiptFilter,
  categoryLabel: (c: Category) => string,
): ExportRow[] {
  const categoryNames = new Map(listCategories(db).map((c) => [c.id, categoryLabel(c)]));
  const folderNames = new Map(listFolders(db).map((f) => [f.id, f.name]));
  const rows: ExportRow[] = [];
  let after: ReceiptCursor | undefined;
  for (;;) {
    const page = listReceipts(db, filter, { limit: CHUNK, after });
    for (const r of page) rows.push(toRow(r, categoryNames, folderNames));
    if (page.length < CHUNK) break;
    const last = page[page.length - 1];
    after = { purchasedAtLocal: last.purchasedAtLocal, id: last.id };
  }
  return rows;
}

function toRow(r: Receipt, categories: Map<string, string>, folders: Map<string, string>): ExportRow {
  const home = r.homeCurrencyAtSave;
  return {
    id: r.id,
    date: r.purchasedAtLocal.slice(0, 10),
    time: r.purchasedAtLocal.slice(11, 16),
    timezone: r.purchasedTz ?? "",
    merchant: r.merchant ?? "",
    category: (r.categoryId && categories.get(r.categoryId)) || "",
    folder: (r.folderId && folders.get(r.folderId)) || "",
    currency: r.currency,
    total: fromMinor(r.totalMinor, r.currency),
    tax: r.taxMinor == null ? "" : fromMinor(r.taxMinor, r.currency),
    homeCurrency: home ?? "",
    homeAmount: r.amountHomeMinor == null || !home ? "" : fromMinor(r.amountHomeMinor, home),
    fxRate: r.fxRate ?? "",
    fxRateDate: r.fxRateDate ?? "",
    fxApproximate: r.fxApproximate,
    notes: r.notes ?? "",
    refNo: r.refNo ?? "",
    receipt: r,
  };
}
