import { addDays } from "@/dates/civil";
import type { RecurringRule } from "@/db/types";
import { convertToHome } from "@/fx/convert";
import type { FxCache } from "@/prefs/prefs";

import { nextOccurrence, type RuleTiming } from "./occurrences";

type T = (key: string, opts?: Record<string, unknown>) => string;

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** Day and month parts of a local "YYYY-MM-DD" (UTC, so the device zone never shifts the day). */
function formatDay(date: string, locale: string, opts: Intl.DateTimeFormatOptions): string {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let fmt = dateFormats.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" });
    dateFormats.set(key, fmt);
  }
  const [y, m, d] = date.split("-").map(Number);
  return fmt.format(Date.UTC(y, m - 1, d));
}

/** "1 Dec" (English uses the day-first order the Stats ranges use). */
export function shortDate(date: string, locale: string): string {
  return formatDay(date, locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short" });
}

/** "Monday" for the weekday of a local date. */
export function weekdayName(date: string, locale: string): string {
  return formatDay(date, locale, { weekday: "long" });
}

export function frequencyLabel(frequency: RecurringRule["frequency"], t: T): string {
  return t(`recurring.${frequency}`);
}

/**
 * The next date this rule will add, never before today: the occurrence after the later of its
 * last created date and yesterday. Null when paused or past its end date.
 */
export function nextDueDate(rule: RuleTiming, today: string): string | null {
  if (rule.paused) return null;
  const last = rule.lastGeneratedDate ?? addDays(rule.anchorDate, -1);
  const yesterday = addDays(today, -1);
  return nextOccurrence(rule, last > yesterday ? last : yesterday);
}

/** Row subtitle: "Monthly, next 1 Dec"; draft-type rules add "Asks you to confirm." */
export function ruleSubtitle(rule: RecurringRule, today: string, locale: string, t: T): string {
  const frequency = frequencyLabel(rule.frequency, t);
  if (rule.paused) return t("recurring.rowPaused", { frequency });
  const next = nextDueDate(rule, today);
  if (next === null) return t("recurring.rowEnded", { frequency });
  return t(rule.autoAdd ? "recurring.rowNext" : "recurring.rowNextDraft", { frequency, date: shortDate(next, locale) });
}

/** Occurrences per year, as a multiple of a month's twelfth: weekly 52, monthly 12, yearly 1. */
const PER_YEAR: Record<RecurringRule["frequency"], number> = { weekly: 52, monthly: 12, yearly: 1 };

/**
 * What the live rules cost in an average month, in home minor units: weekly x 52 / 12,
 * monthly x 1, yearly / 12, each converted at today's cached rate. Paused and finished rules
 * cost nothing. Rules without a rate are left out and counted in `skipped`. One rounding at the end.
 */
export function monthlyEquivalent(
  rules: RecurringRule[],
  home: string,
  fx: FxCache,
  today: string,
): { homeMinor: number; skipped: number } {
  let twelfths = 0;
  let skipped = 0;
  for (const rule of rules) {
    if (nextDueDate(rule, today) === null) continue;
    let amount: number | null = null;
    try {
      amount = convertToHome(rule.totalMinor, rule.currency, home, today, fx)?.amountHomeMinor ?? null;
    } catch {
      amount = null; // currency outside the ISO table
    }
    if (amount === null) {
      skipped += 1;
      continue;
    }
    twelfths += amount * PER_YEAR[rule.frequency];
  }
  return { homeMinor: Math.round(twelfths / 12), skipped };
}
