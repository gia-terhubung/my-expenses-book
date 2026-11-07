import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";

import { notifyDataChanged } from "@/db/changes";
import { now } from "@/db/ids";
import { receipts } from "@/db/schema";
import type { AppDb } from "@/db/types";
import type { FxCache } from "@/prefs/prefs";

import { convertToHome } from "./convert";

/** YYYY-MM-DD from a local ISO timestamp. */
const dateOf = (local: string) => local.slice(0, 10);

/**
 * A rate the user typed on the review screen: `fxRate` set with no table date. It stays while the
 * home currency is unchanged (a home change makes it meaningless, so the row is reconverted).
 */
export function isManualRate(r: { fxRate: string | null; fxRateDate: string | null }): boolean {
  return r.fxRate !== null && r.fxRateDate === null;
}

/**
 * Recomputes the home-currency amount of every non-deleted receipt, except manual rates for the
 * current home. Writes (and bumps version/updatedAt) only rows whose FX columns actually change.
 * A row already converted to the same `home` is never downgraded: when the cache has no rate for
 * it (e.g. its date was pruned) the existing conversion stays, and an exact-date conversion is not
 * replaced by an approximate one. Fields are nulled only when the home currency changed and no
 * rate exists for the new home. Returns rows changed.
 */
export function reconvertAll(db: AppDb, home: string, cache: FxCache): number {
  const rows = db.select().from(receipts).where(isNull(receipts.deletedAt)).all();
  const t = now();
  let changed = 0;
  db.transaction((tx) => {
    for (const r of rows) {
      if (isManualRate(r) && r.homeCurrencyAtSave === home && r.amountHomeMinor !== null) continue;
      let c = null;
      try {
        c = convertToHome(r.totalMinor, r.currency, home, dateOf(r.purchasedAtLocal), cache);
      } catch {
        // currency/home outside the ISO table: leave unconverted
      }
      const convertedForHome = r.homeCurrencyAtSave === home && r.amountHomeMinor !== null;
      if (convertedForHome && (c === null || (c.approximate && !r.fxApproximate))) continue;
      const next = {
        fxRate: c?.fxRate ?? null,
        fxRateDate: c?.fxRateDate ?? null,
        amountHomeMinor: c?.amountHomeMinor ?? null,
        fxApproximate: c?.approximate ?? false,
        homeCurrencyAtSave: home,
      };
      if (
        r.fxRate === next.fxRate &&
        r.fxRateDate === next.fxRateDate &&
        r.amountHomeMinor === next.amountHomeMinor &&
        r.fxApproximate === next.fxApproximate &&
        r.homeCurrencyAtSave === next.homeCurrencyAtSave
      ) {
        continue;
      }
      tx.update(receipts)
        .set({ ...next, updatedAt: t, version: sql`${receipts.version} + 1` })
        .where(eq(receipts.id, r.id))
        .run();
      changed++;
    }
  });
  if (changed > 0) notifyDataChanged();
  return changed;
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

/**
 * Distinct purchase dates (newest first, max `limit` per call) of foreign-currency receipts that
 * still need work for `home` (no amount, converted for another home, or only approximate) and
 * whose date `known` says is not cached yet. Called once per sync pass, so successive passes work
 * through older receipts instead of re-asking for the same newest dates.
 */
export function receiptDatesNeedingRates(
  db: AppDb,
  home: string,
  known: (date: string) => boolean = () => false,
  limit = 30,
): string[] {
  const day = sql<string>`substr(${receipts.purchasedAtLocal}, 1, 10)`;
  const rows = db
    .select({ d: day })
    .from(receipts)
    .where(
      and(
        isNull(receipts.deletedAt),
        ne(receipts.currency, home),
        or(
          isNull(receipts.amountHomeMinor),
          isNull(receipts.homeCurrencyAtSave),
          ne(receipts.homeCurrencyAtSave, home),
          eq(receipts.fxApproximate, true),
        ),
      ),
    )
    .groupBy(day)
    .orderBy(desc(day))
    .all();
  const out: string[] = [];
  for (const { d } of rows) {
    if (out.length >= limit) break;
    if (!known(d)) out.push(d);
  }
  return out;
}
