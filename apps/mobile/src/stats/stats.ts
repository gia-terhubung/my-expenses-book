// Pure stats math for the slip pace line and the Statistik screen. Dates are local
// "YYYY-MM-DD", months "YYYY-MM"; integer/string arithmetic only, no Date.
import { daysInMonth, pad2 } from "../dates/civil";
import { payPeriodOf, previousPayPeriod } from "./payPeriod";
import { taxYearOf, taxYearRange } from "../taxYear/taxYear";

type Range = { from: string; to: string };
export type PacePeriods = { current: Range; previous: Range; previousMonth: string };

const OTHER_CATEGORY = "default:other";

/**
 * This pay period so far vs the previous one up to the same day offset (or its last day if
 * shorter). `startDay` 1 is the calendar month.
 */
export function pacePeriods(today: string, startDay = 1): PacePeriods {
  const cur = payPeriodOf(today, startDay);
  const prev = previousPayPeriod(cur, startDay);
  // Same calendar day one month back (clamped to that month), kept inside the previous period.
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  const py = month === 1 ? year - 1 : year;
  const pm = month === 1 ? 12 : month - 1;
  const sameDay = `${py}-${pad2(pm)}-${pad2(Math.min(day, daysInMonth(py, pm)))}`;
  const to = sameDay > prev.to ? prev.to : sameDay < prev.from ? prev.from : sameDay;
  return {
    current: { from: cur.from, to: today },
    previous: { from: prev.from, to },
    previousMonth: prev.label,
  };
}

/**
 * Tax year so far vs the same date in the previous tax year (Feb 29 clamps to Feb 28).
 * `previousMonth` is the month the previous range starts in.
 */
export function taxYearPacePeriods(today: string, startMonth: number): PacePeriods {
  const ty = taxYearOf(today, startMonth);
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));
  const prevYear = Number(today.slice(0, 4)) - 1;
  const from = taxYearRange(ty - 1, startMonth).from;
  return {
    current: { from: taxYearRange(ty, startMonth).from, to: today },
    previous: { from, to: `${prevYear}-${pad2(month)}-${pad2(Math.min(day, daysInMonth(prevYear, month)))}` },
    previousMonth: from.slice(0, 7),
  };
}

/** Whole-percent change, or null when there is no previous amount to compare with. */
export function pacePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

type CategoryRow = { categoryId: string | null; total: { homeMinor: number } };

/**
 * Top `topN` named categories plus a "rest" bucket. `default:other` and uncategorised
 * rows never take a top slot. Shares are of the converted total. [] if under 2
 * categories have a converted amount.
 */
export function categoryStrip(
  rows: CategoryRow[],
  topN = 3,
): { categoryId: string | null; share: number }[] {
  const live = rows.filter((r) => r.total.homeMinor > 0);
  const total = live.reduce((n, r) => n + r.total.homeMinor, 0);
  if (live.length < 2 || total === 0) return [];
  const named = live
    .filter((r) => r.categoryId !== null && r.categoryId !== OTHER_CATEGORY)
    .sort((a, b) => b.total.homeMinor - a.total.homeMinor);
  const top = named.slice(0, topN);
  const out: { categoryId: string | null; share: number }[] = top.map((r) => ({
    categoryId: r.categoryId,
    share: r.total.homeMinor / total,
  }));
  const rest = total - top.reduce((n, r) => n + r.total.homeMinor, 0);
  if (rest > 0) out.push({ categoryId: "rest", share: rest / total });
  return out;
}

/** The `n` month keys ending at today's month, oldest first. */
export function lastMonths(today: string, n: number): string[] {
  let year = Number(today.slice(0, 4));
  let month = Number(today.slice(5, 7));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.unshift(`${year}-${pad2(month)}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return out;
}

/** The 12 month keys of the tax year starting in `ty`, first month first. */
export function taxYearMonths(ty: number, startMonth: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const m = startMonth - 1 + i;
    out.push(`${ty + Math.floor(m / 12)}-${pad2((m % 12) + 1)}`);
  }
  return out;
}
