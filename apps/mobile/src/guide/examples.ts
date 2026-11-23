// Live example text for the guide and the (i) sheets. Dates are local "YYYY-MM-DD".
import { currencyExponent } from "@/money/currencies";
import { formatMoney } from "@/money/money";
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

/** Rounded illustrative rates (home units per 1 EUR) for the currency step's example only. */
export const EXAMPLE_RATES_PER_EUR: Record<string, number> = {
  IDR: 17000,
  USD: 1.08,
  GBP: 0.85,
  BRL: 6.2,
  MXN: 20,
  ARS: 1000,
  COP: 4500,
  CLP: 1000,
  PEN: 4,
  AUD: 1.65,
  CAD: 1.5,
  SGD: 1.45,
  MYR: 5,
  JPY: 165,
  INR: 92,
  PHP: 62,
  THB: 38,
  CHF: 0.95,
};

/** About €12.00 in `home`, formatted; null when home is EUR or has no example rate. */
export function currencyExampleHome(home: string, locale: string): string | null {
  const rate = EXAMPLE_RATES_PER_EUR[home];
  if (home === "EUR" || rate === undefined) return null;
  const minor = Math.round(12 * rate * 10 ** currencyExponent(home));
  return formatMoney(minor, home, locale);
}
