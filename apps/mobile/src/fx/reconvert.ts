import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";

import { now } from "@/db/ids";
import { receipts } from "@/db/schema";
import type { AppDb } from "@/db/types";
import type { FxCache } from "@/prefs/prefs";

import { convertToHome } from "./convert";

/** YYYY-MM-DD from a local ISO timestamp. */
const dateOf = (local: string) => local.slice(0, 10);

/** Recomputes the home-currency amount of every non-deleted receipt. Returns rows updated. */
export function reconvertAll(db: AppDb, home: string, cache: FxCache): number {
  const rows = db.select().from(receipts).where(isNull(receipts.deletedAt)).all();
  const t = now();
  db.transaction((tx) => {
    for (const r of rows) {
      let c = null;
      try {
        c = convertToHome(r.totalMinor, r.currency, home, dateOf(r.purchasedAtLocal), cache);
      } catch {
        // currency/home outside the ISO table: leave unconverted
      }
      tx.update(receipts)
        .set({
          fxRate: c?.fxRate ?? null,
          fxRateDate: c?.fxRateDate ?? null,
          amountHomeMinor: c?.amountHomeMinor ?? null,
          fxApproximate: c?.approximate ?? false,
          homeCurrencyAtSave: home,
          updatedAt: t,
          version: sql`${receipts.version} + 1`,
        })
        .where(eq(receipts.id, r.id))
        .run();
    }
  });
  return rows.length;
}

/** True when some non-deleted receipt is not yet converted to `home`. */
export function needsReconvert(db: AppDb, home: string): boolean {
  const row = db
    .select({ id: receipts.id })
    .from(receipts)
    .where(
      and(
        isNull(receipts.deletedAt),
        or(isNull(receipts.homeCurrencyAtSave), ne(receipts.homeCurrencyAtSave, home), isNull(receipts.amountHomeMinor)),
      ),
    )
    .limit(1)
    .get();
  return row !== undefined;
}

/** Distinct purchase dates (newest first, max `limit`) of foreign-currency receipts. */
export function receiptDatesNeedingRates(db: AppDb, home: string, limit = 30): string[] {
  const rows = db
    .select({ d: sql<string>`substr(${receipts.purchasedAtLocal}, 1, 10)` })
    .from(receipts)
    .where(and(isNull(receipts.deletedAt), ne(receipts.currency, home)))
    .groupBy(sql`substr(${receipts.purchasedAtLocal}, 1, 10)`)
    .orderBy(desc(sql`substr(${receipts.purchasedAtLocal}, 1, 10)`))
    .limit(limit)
    .all();
  return rows.map((r) => r.d);
}
