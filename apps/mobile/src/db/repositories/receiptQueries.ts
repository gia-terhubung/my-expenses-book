import { and, desc, eq, gte, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import { receipts } from "../schema";
import type { AppDb, Receipt } from "../types";
import { toFtsQuery } from "./receipts";

export type ReceiptFilter = {
  /** FTS5 over merchant, notes, raw_ocr_text (via toFtsQuery). */
  text?: string;
  /** Inclusive local date YYYY-MM-DD, compared to purchased_at_local. */
  from?: string;
  /** Inclusive local date YYYY-MM-DD. */
  to?: string;
  /** Any-of; undefined or [] = all. */
  categoryIds?: string[];
  /** undefined = any folder, null = no folder. */
  folderId?: string | null;
  /** Receipt currency, ISO upper-case. */
  currency?: string;
};
export type ReceiptCursor = { purchasedAtLocal: string; id: string };
export type HomeTotal = { homeMinor: number; count: number; unconverted: number };

const localDay = sql`substr(${receipts.purchasedAtLocal}, 1, 10)`;
const month = sql<string>`substr(${receipts.purchasedAtLocal}, 1, 7)`;

/** Confirmed, live rows matching the filter. A text filter with nothing searchable matches no rows. */
function conditions(filter: ReceiptFilter): SQL[] {
  const c: SQL[] = [eq(receipts.status, "confirmed"), isNull(receipts.deletedAt)];
  if (filter.text !== undefined) {
    const match = toFtsQuery(filter.text);
    c.push(
      match
        ? sql`receipts.rowid IN (SELECT rowid FROM receipts_fts WHERE receipts_fts MATCH ${match})`
        : sql`0`,
    );
  }
  if (filter.from) c.push(gte(receipts.purchasedAtLocal, filter.from));
  if (filter.to) c.push(sql`${localDay} <= ${filter.to}`);
  if (filter.categoryIds && filter.categoryIds.length > 0) {
    c.push(inArray(receipts.categoryId, filter.categoryIds));
  }
  if (filter.folderId !== undefined) {
    c.push(filter.folderId === null ? isNull(receipts.folderId) : eq(receipts.folderId, filter.folderId));
  }
  if (filter.currency) c.push(eq(receipts.currency, filter.currency));
  return c;
}

export function listReceipts(
  db: AppDb,
  filter: ReceiptFilter,
  page: { limit: number; after?: ReceiptCursor },
): Receipt[] {
  const c = conditions(filter);
  if (page.after) {
    const { purchasedAtLocal: l, id } = page.after;
    c.push(
      or(
        sql`${receipts.purchasedAtLocal} < ${l}`,
        and(eq(receipts.purchasedAtLocal, l), sql`${receipts.id} < ${id}`),
      )!,
    );
  }
  return db
    .select()
    .from(receipts)
    .where(and(...c))
    .orderBy(desc(receipts.purchasedAtLocal), desc(receipts.id))
    .limit(page.limit)
    .all();
}

/** Only rows converted to the current home count towards homeMinor; all others are unconverted. */
function totalColumns(home: string) {
  const converted = sql`${receipts.homeCurrencyAtSave} = ${home} AND ${receipts.amountHomeMinor} IS NOT NULL`;
  return {
    homeMinor: sql<number>`COALESCE(SUM(CASE WHEN ${converted} THEN ${receipts.amountHomeMinor} ELSE 0 END), 0)`,
    count: sql<number>`COUNT(*)`,
    unconverted: sql<number>`COALESCE(SUM(CASE WHEN ${converted} THEN 0 ELSE 1 END), 0)`,
  };
}

export function sumHome(db: AppDb, filter: ReceiptFilter, home: string): HomeTotal {
  const row = db
    .select(totalColumns(home))
    .from(receipts)
    .where(and(...conditions(filter)))
    .get();
  return row ?? { homeMinor: 0, count: 0, unconverted: 0 };
}

/** Totals keyed by local "YYYY-MM". */
export function monthTotals(db: AppDb, filter: ReceiptFilter, home: string): Record<string, HomeTotal> {
  const rows = db
    .select({ month, ...totalColumns(home) })
    .from(receipts)
    .where(and(...conditions(filter)))
    .groupBy(month)
    .orderBy(desc(month))
    .all();
  const out: Record<string, HomeTotal> = {};
  for (const { month: m, ...t } of rows) out[m] = t;
  return out;
}

/** Distinct local "YYYY-MM" of confirmed live receipts, newest first. */
export function listPurchaseMonths(db: AppDb): string[] {
  return db
    .selectDistinct({ month })
    .from(receipts)
    .where(and(...conditions({})))
    .orderBy(desc(month))
    .all()
    .map((r) => r.month);
}

/** Distinct receipt currencies of confirmed live receipts, sorted. */
export function listCurrenciesInUse(db: AppDb): string[] {
  return db
    .selectDistinct({ currency: receipts.currency })
    .from(receipts)
    .where(and(...conditions({})))
    .orderBy(receipts.currency)
    .all()
    .map((r) => r.currency);
}
