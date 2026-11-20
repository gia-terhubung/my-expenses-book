import { and, eq, isNull, sql } from "drizzle-orm";

import { notifyDataChanged } from "@/db/changes";
import { newId, now as nowMs } from "@/db/ids";
import { receipts, recurringRules } from "@/db/schema";
import type { AppDb, NewRecurringRuleInput, RecurringRule } from "@/db/types";
import { addDays } from "@/dates/civil";

import { nextOccurrence, todayIn } from "./occurrences";

const later = (a: string | null, b: string): string => (a !== null && a > b ? a : b);

/** The next date catch-up will create for `rule` (ignores pause), or null once past endDate. */
function nextDue(rule: RecurringRule): string | null {
  return nextOccurrence(rule, rule.lastGeneratedDate ?? addDays(rule.anchorDate, -1));
}

/** Live rules, soonest next due first; rules with nothing left to create come last. */
export function listRules(db: AppDb): RecurringRule[] {
  const rows = db.select().from(recurringRules).where(isNull(recurringRules.deletedAt)).all();
  const keyed = rows.map((r) => ({ r, next: nextDue(r) }));
  keyed.sort((a, b) => {
    if (a.next !== b.next) {
      if (a.next === null) return 1;
      if (b.next === null) return -1;
      return a.next < b.next ? -1 : 1;
    }
    return a.r.id < b.r.id ? -1 : a.r.id > b.r.id ? 1 : 0;
  });
  return keyed.map((k) => k.r);
}

function getLiveRule(db: AppDb, id: string): RecurringRule {
  const row = db
    .select()
    .from(recurringRules)
    .where(and(eq(recurringRules.id, id), isNull(recurringRules.deletedAt)))
    .get();
  if (!row) throw new Error(`Recurring rule not found: ${id}`);
  return row;
}

function ruleValues(input: NewRecurringRuleInput, lastGeneratedDate: string | null) {
  const t = nowMs();
  return { ...input, lastGeneratedDate, id: newId(), createdAt: t, updatedAt: t };
}

/**
 * New rule. No backfill: when the anchor is today or earlier, catch-up starts after today;
 * a future anchor is created on its own day.
 */
export function createRule(db: AppDb, input: NewRecurringRuleInput, now: Date): RecurringRule {
  const today = todayIn(input.tz, now);
  const row = db
    .insert(recurringRules)
    .values(ruleValues(input, input.anchorDate <= today ? today : null))
    .returning()
    .get();
  notifyDataChanged();
  return row;
}

/**
 * "Repeat this…": a new rule whose first occurrence is the existing receipt. Links the receipt to
 * the rule at its local date and starts catch-up after the later of that date and today.
 */
export function createRuleFromReceipt(
  db: AppDb,
  receiptId: string,
  input: NewRecurringRuleInput,
  now: Date,
): RecurringRule {
  const today = todayIn(input.tz, now);
  const rule = db.transaction((tx) => {
    const receipt = tx
      .select({ purchasedAtLocal: receipts.purchasedAtLocal })
      .from(receipts)
      .where(and(eq(receipts.id, receiptId), isNull(receipts.deletedAt)))
      .get();
    if (!receipt) throw new Error(`Receipt not found: ${receiptId}`);
    const date = receipt.purchasedAtLocal.slice(0, 10);
    const row = tx.insert(recurringRules).values(ruleValues(input, later(date, today))).returning().get();
    tx.update(receipts)
      .set({
        recurringRuleId: row.id,
        recurringDate: date,
        updatedAt: nowMs(),
        version: sql`${receipts.version} + 1`,
      })
      .where(eq(receipts.id, receiptId))
      .run();
    return row;
  });
  notifyDataChanged();
  return rule;
}

/** Edits a rule. Never backfills: catch-up resumes after the later of lastGeneratedDate and today. */
export function updateRule(
  db: AppDb,
  id: string,
  patch: Partial<NewRecurringRuleInput>,
  now: Date,
): RecurringRule {
  const current = getLiveRule(db, id);
  const today = todayIn(patch.tz ?? current.tz, now);
  const row = db
    .update(recurringRules)
    .set({
      ...patch,
      lastGeneratedDate: later(current.lastGeneratedDate, today),
      updatedAt: nowMs(),
      version: sql`${recurringRules.version} + 1`,
    })
    .where(and(eq(recurringRules.id, id), isNull(recurringRules.deletedAt)))
    .returning()
    .get();
  if (!row) throw new Error(`Recurring rule not found: ${id}`);
  notifyDataChanged();
  return row;
}

/** Pauses or resumes. Resuming skips everything that fell due while paused. */
export function setPaused(db: AppDb, id: string, paused: boolean, now: Date): void {
  const current = getLiveRule(db, id);
  const lastGeneratedDate = paused
    ? current.lastGeneratedDate
    : later(current.lastGeneratedDate, todayIn(current.tz, now));
  db.update(recurringRules)
    .set({ paused, lastGeneratedDate, updatedAt: nowMs(), version: sql`${recurringRules.version} + 1` })
    .where(and(eq(recurringRules.id, id), isNull(recurringRules.deletedAt)))
    .run();
  notifyDataChanged();
}

/** Soft-deletes the rule; receipts it already created stay as they are. */
export function softDeleteRule(db: AppDb, id: string): void {
  const t = nowMs();
  db.update(recurringRules)
    .set({ deletedAt: t, updatedAt: t, version: sql`${recurringRules.version} + 1` })
    .where(and(eq(recurringRules.id, id), isNull(recurringRules.deletedAt)))
    .run();
  notifyDataChanged();
}
