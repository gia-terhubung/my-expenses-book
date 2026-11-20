// Pure occurrence engine for recurring rules. Dates are local "YYYY-MM-DD" strings and all
// arithmetic is integer civil-day math (no Date), so results never shift with time zones or DST.
import { formatLocal } from "../capture/localTime";
import { addDays, daysInMonth, isValidYmd, toDayNumber, ymd } from "../dates/civil";
import type { RecurringRule } from "../db/types";

export type RuleTiming = Pick<
  RecurringRule,
  "frequency" | "anchorDate" | "monthDay" | "endDate" | "paused" | "lastGeneratedDate"
>;

/** Today's `YYYY-MM-DD` in `tz`. */
export function todayIn(tz: string, now: Date): string {
  return formatLocal(now, tz).slice(0, 10);
}

const parts = (date: string): [number, number, number] => [
  Number(date.slice(0, 4)),
  Number(date.slice(5, 7)),
  Number(date.slice(8, 10)),
];

/**
 * False when the loops below could not terminate or would invent dates: a non-date anchor, end
 * or last-generated date (a damaged backup), or a monthly day outside -1 and 1-28.
 */
function isUsable(rule: RuleTiming): boolean {
  if (!isValidYmd(rule.anchorDate)) return false;
  if (rule.endDate !== null && !isValidYmd(rule.endDate)) return false;
  if (rule.lastGeneratedDate !== null && !isValidYmd(rule.lastGeneratedDate)) return false;
  const md = rule.monthDay;
  if (rule.frequency === "monthly" && md !== null && !(md === -1 || (Number.isInteger(md) && md >= 1 && md <= 28))) {
    return false;
  }
  return true;
}

/** The first occurrence on or after `from` (and on or after the anchor). Ignores endDate. */
function onOrAfter(rule: RuleTiming, from: string): string {
  const start = from < rule.anchorDate ? rule.anchorDate : from;
  const [y, m, d] = parts(start);
  const [, am, ad] = parts(rule.anchorDate);

  if (rule.frequency === "weekly") {
    const gap = (((toDayNumber(start) - toDayNumber(rule.anchorDate)) % 7) + 7) % 7;
    return addDays(start, (7 - gap) % 7);
  }

  if (rule.frequency === "yearly") {
    for (let yy = y; ; yy++) {
      const cand = ymd(yy, am, Math.min(ad, daysInMonth(yy, am)));
      if (cand >= start) return cand;
    }
  }

  // monthly: monthDay is 1-28 or -1 (last day); fall back to the anchor's day if unset.
  const md = rule.monthDay ?? ad;
  let yy = y;
  let mm = m;
  for (;;) {
    const dim = daysInMonth(yy, mm);
    const cand = ymd(yy, mm, md === -1 ? dim : Math.min(md, dim));
    if (cand >= start) return cand;
    if (mm === 12) {
      yy += 1;
      mm = 1;
    } else {
      mm += 1;
    }
  }
}

/** The first occurrence strictly after `after`, or null once past `endDate` (or for invalid input). */
export function nextOccurrence(rule: RuleTiming, after: string): string | null {
  if (!isUsable(rule) || !isValidYmd(after)) return null;
  const next = onOrAfter(rule, addDays(after, 1));
  return rule.endDate !== null && next > rule.endDate ? null : next;
}

/**
 * Occurrences after `lastGeneratedDate` (from `anchorDate` inclusive when null), up to and
 * including `today`, never after `endDate`. Empty when paused, and for invalid input.
 */
export function dueOccurrences(rule: RuleTiming, today: string): string[] {
  if (rule.paused || !isUsable(rule) || !isValidYmd(today)) return [];
  const out: string[] = [];
  let cur: string | null =
    rule.lastGeneratedDate === null
      ? onOrAfter(rule, rule.anchorDate)
      : nextOccurrence(rule, rule.lastGeneratedDate);
  while (cur !== null && cur <= today && (rule.endDate === null || cur <= rule.endDate)) {
    out.push(cur);
    cur = nextOccurrence(rule, cur);
  }
  return out;
}
