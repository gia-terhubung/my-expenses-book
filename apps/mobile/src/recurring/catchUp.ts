import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { deviceTimeZone, localToUtc } from "@/capture/localTime";
import { notifyDataChanged } from "@/db/changes";
import { newId, now as nowMs } from "@/db/ids";
import { receipts, recurringRules } from "@/db/schema";
import type { AppDb, RecurringRule } from "@/db/types";
import { logError } from "@/errorLog/instance";
import { convertToHome, type Conversion } from "@/fx/convert";
import type { FxCache } from "@/prefs/prefs";

import { dueOccurrences, todayIn } from "./occurrences";

export type CatchUpResult = { createdIds: string[]; draftCount: number };

/** Created occurrences are stamped at this wall time in the rule's zone. */
const OCCURRENCE_TIME = "09:00:00";

/** True for a SQLite UNIQUE violation, also when wrapped (Drizzle puts the driver error in `cause`). */
function isUniqueViolation(e: unknown): boolean {
  for (let cur = e, depth = 0; cur && depth < 5; depth++) {
    // Duck-typed: driver errors may come from another realm, where `instanceof Error` is false.
    const { message, cause } = cur as { message?: unknown; cause?: unknown };
    if (typeof message === "string" && /UNIQUE constraint failed/i.test(message)) return true;
    cur = cause;
  }
  return false;
}

function convert(rule: RecurringRule, date: string, home: string, fx: FxCache): Conversion | null {
  try {
    return convertToHome(rule.totalMinor, rule.currency, home, date, fx);
  } catch {
    return null; // currency outside the ISO table: left for syncFx, like any unconverted row
  }
}

/**
 * Turns every due occurrence of every live rule into a receipt (confirmed when the rule adds
 * automatically, else a draft), dated `<date>T09:00:00` in the rule's zone. Synchronous: two calls
 * cannot interleave. Per rule, the inserts and the lastGeneratedDate advance share one
 * transaction; an occurrence that already has a live row (partial unique index) is skipped. A rule
 * that fails for any other reason is rolled back, logged and retried on the next run.
 */
export function runCatchUp(db: AppDb, opts: { now: Date; home: string; fx: FxCache }): CatchUpResult {
  const { now, home, fx } = opts;
  const rules = db.select().from(recurringRules).where(isNull(recurringRules.deletedAt)).all();
  const scannedTz = deviceTimeZone();
  const createdIds: string[] = [];
  let draftCount = 0;

  for (const rule of rules) {
    const dates = dueOccurrences(rule, todayIn(rule.tz, now));
    if (dates.length === 0) continue;
    try {
      const created = db.transaction((tx) => {
        const ids: string[] = [];
        for (const date of dates) {
          const local = `${date}T${OCCURRENCE_TIME}`;
          const conv = convert(rule, date, home, fx);
          const t = nowMs();
          try {
            const row = tx
              .insert(receipts)
              .values({
                id: newId(),
                createdAt: t,
                updatedAt: t,
                status: rule.autoAdd ? "confirmed" : "draft",
                merchant: rule.merchant,
                purchasedAtLocal: local,
                purchasedTz: rule.tz,
                purchasedAtUtc: localToUtc(local, rule.tz),
                scannedAtUtc: now.getTime(),
                scannedTz,
                currency: rule.currency,
                totalMinor: rule.totalMinor,
                taxMinor: rule.taxMinor,
                categoryId: rule.categoryId,
                folderId: rule.folderId,
                notes: rule.notes,
                parseSource: "manual",
                parseConfidence: null,
                recurringRuleId: rule.id,
                recurringDate: date,
                ...(conv
                  ? {
                      amountHomeMinor: conv.amountHomeMinor,
                      fxRate: conv.fxRate,
                      fxRateDate: conv.fxRateDate,
                      fxApproximate: conv.approximate,
                      homeCurrencyAtSave: home,
                    }
                  : {}),
              })
              .returning({ id: receipts.id })
              .get();
            ids.push(row.id);
          } catch (e) {
            if (!isUniqueViolation(e)) throw e;
            // Already created (another run, or "Repeat this…" linked it): skip this occurrence.
          }
        }
        tx.update(recurringRules)
          .set({
            lastGeneratedDate: dates[dates.length - 1],
            updatedAt: nowMs(),
            version: sql`${recurringRules.version} + 1`,
          })
          .where(eq(recurringRules.id, rule.id))
          .run();
        return ids;
      });
      createdIds.push(...created);
      if (!rule.autoAdd) draftCount += created.length;
    } catch (e) {
      logError("recurring", e);
    }
  }

  if (createdIds.length > 0) notifyDataChanged();
  return { createdIds, draftCount };
}

/** Soft-deletes receipts a catch-up run created. lastGeneratedDate is not rewound, so they stay gone. */
export function undoCatchUp(db: AppDb, ids: string[]): void {
  if (ids.length === 0) return;
  const t = nowMs();
  db.update(receipts)
    .set({ deletedAt: t, updatedAt: t, version: sql`${receipts.version} + 1` })
    .where(and(inArray(receipts.id, ids), isNotNull(receipts.recurringRuleId), isNull(receipts.deletedAt)))
    .run();
  notifyDataChanged();
}
