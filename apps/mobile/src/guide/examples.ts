// Live example text for the guide and the (i) sheets. Dates are local "YYYY-MM-DD".
import { payPeriodOf } from "@/stats/payPeriod";
import { taxYearLabel, taxYearOf, taxYearRange } from "@/taxYear/taxYear";

const dayMonth = new Map<string, Intl.DateTimeFormat>();
const dayMonthYear = new Map<string, Intl.DateTimeFormat>();

function cached(cache: Map<string, Intl.DateTimeFormat>, locale: string, withYear: boolean) {
  let fmt = cache.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" as const } : {}),
      timeZone: "UTC",
    });
    cache.set(locale, fmt);
  }
  return fmt;
}

const asUtc = (d: string) => new Date(`${d}T00:00:00Z`);

/** "Oct 25 – Nov 24" (day and short month, locale order). */
export function formatDayRange(from: string, to: string, locale: string, withYear = false): string {
  const fmt = cached(withYear ? dayMonthYear : dayMonth, locale, withYear);
  return `${fmt.format(asUtc(from))} – ${fmt.format(asUtc(to))}`;
}

/** The pay cycle containing `today` when it starts on `day`. */
export function payCycleExample(today: string, day: number, locale: string): string {
  const p = payPeriodOf(today, day);
  return formatDayRange(p.from, p.to, locale);
}

/** The tax year containing `today`: its label ("2026/27") and its range with years. */
export function taxYearExample(today: string, startMonth: number, locale: string): { label: string; range: string } {
  const year = taxYearOf(today, startMonth);
  const r = taxYearRange(year, startMonth);
  return { label: taxYearLabel(year, startMonth), range: formatDayRange(r.from, r.to, locale, true) };
}
