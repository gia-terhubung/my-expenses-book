import type { AppDb } from "@/db/types";
import { i18n } from "@/i18n";

import { nextOccurrence, todayIn } from "./occurrences";
import { listRules } from "./rules";

/** Port over the OS local-notification API (device implementation: `deviceScheduler.ts`). */
export interface LocalScheduler {
  /** Cancels this feature's notifications only, never anyone else's. */
  cancelAll(tag: "recurring"): Promise<void>;
  schedule(n: {
    id: string;
    title: string;
    body: string;
    /** Device-local wall-clock time. */
    at: { year: number; month: number; day: number; hour: 9; minute: 0 };
    data: { ruleId: string; date: string };
  }): Promise<void>;
  permission(): Promise<"granted" | "denied" | "undetermined">;
  request(): Promise<"granted" | "denied">;
}

/**
 * Replaces all recurring notifications with one per live, unpaused draft-type rule (autoAdd off),
 * at 09:00 on its next occurrence after today in the rule's own zone. Never asks for permission:
 * without a grant it schedules nothing. Neither title nor body carries an amount. Returns the
 * number scheduled.
 */
export async function rescheduleAll(db: AppDb, s: LocalScheduler, now: Date): Promise<number> {
  await s.cancelAll("recurring");
  if ((await s.permission()) !== "granted") return 0;
  let count = 0;
  for (const rule of listRules(db)) {
    if (rule.autoAdd || rule.paused) continue;
    const date = nextOccurrence(rule, todayIn(rule.tz, now));
    if (date === null) continue;
    const merchant = rule.merchant?.trim() || i18n.t("recurring.notifyUnnamed");
    await s.schedule({
      id: `recurring-${rule.id}`,
      title: i18n.t("recurring.notifyTitle", { merchant }),
      body: i18n.t("recurring.notifyBody", { merchant }),
      at: { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)), day: Number(date.slice(8, 10)), hour: 9, minute: 0 },
      data: { ruleId: rule.id, date },
    });
    count += 1;
  }
  return count;
}

/** Call when a draft-type rule is saved: asks the OS only while the answer is still undetermined. */
export async function ensurePermissionForDraftRule(s: LocalScheduler): Promise<boolean> {
  const p = await s.permission();
  if (p === "undetermined") return (await s.request()) === "granted";
  return p === "granted";
}
