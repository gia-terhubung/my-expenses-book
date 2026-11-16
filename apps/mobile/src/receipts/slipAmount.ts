import { formatMoney } from "@/money/money";
import { compactAmount } from "@/stats/compactAmount";

/**
 * Slip total text: the full amount while it fits in `maxChars`, else the compact form. `exact` is
 * always the full amount, for the accessibility label.
 */
export function slipAmountText(
  minor: number,
  currency: string,
  locale: string,
  maxChars = 16,
): { text: string; exact: string; compact: boolean } {
  const exact = formatMoney(minor, currency, locale);
  if (exact.length <= maxChars) return { text: exact, exact, compact: false };
  return { text: compactAmount(minor, currency, locale), exact, compact: true };
}
