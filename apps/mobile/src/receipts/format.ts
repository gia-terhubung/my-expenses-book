import type { HomeTotal } from "@/db/repositories/receiptQueries";
import type { Receipt } from "@/db/types";
import { formatMoney } from "@/money/money";

// One formatter per locale: building Intl formatters is slow on Hermes (one per section header).
const monthFormats = new Map<string, Intl.DateTimeFormat>();

/** "2026-11" -> "November 2026" (locale-aware). */
export function monthLabel(yyyyMm: string, locale: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  let fmt = monthFormats.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
    monthFormats.set(locale, fmt);
  }
  return fmt.format(Date.UTC(y, m - 1, 1));
}

/** Home-currency amount line; null when the receipt is already in home, "—" when not converted. */
export function homeLine(
  r: Receipt,
  home: string,
  locale: string,
): string | null {
  if (r.currency === home) return null;
  if (r.amountHomeMinor == null || r.homeCurrencyAtSave !== home) return "—";
  const money = formatMoney(r.amountHomeMinor, home, locale);
  return r.fxApproximate ? `≈ ${money}` : money;
}

/** Home total, plus the not-converted note when some rows could not be converted. */
export function totalLine(
  t: HomeTotal,
  home: string,
  locale: string,
  notConverted: (n: number) => string,
): string {
  const money = formatMoney(t.homeMinor, home, locale);
  return t.unconverted > 0
    ? `${money} · ${notConverted(t.unconverted)}`
    : money;
}
