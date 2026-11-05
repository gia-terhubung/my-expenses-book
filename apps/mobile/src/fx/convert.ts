import { currencyExponent } from "@/money/currencies";
import type { FxCache } from "@/prefs/prefs";

export interface Conversion {
  amountHomeMinor: number;
  /** Home units per 1 receipt-currency unit, plain decimal. */
  fxRate: string;
  fxRateDate: string;
  approximate: boolean;
}

const SCALE = 12;

/** Parses "0.0000613", "6.13e-5", "5E-5", "20000" into an exact fraction n/10^k. */
function parseDecimal(s: string): { n: bigint; k: number } | null {
  const m = /^(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s.trim());
  if (!m) return null;
  const frac = m[2] ?? "";
  let n = BigInt(m[1] + frac);
  let k = frac.length;
  const e = m[3] ? parseInt(m[3], 10) : 0;
  if (e >= 0) {
    n *= 10n ** BigInt(e);
  } else {
    k += -e;
  }
  if (n === 0n) return null;
  return { n, k };
}

/** a / b rounded half away from zero (b > 0). */
function divRound(a: bigint, b: bigint): bigint {
  const neg = a < 0n;
  const abs = neg ? -a : a;
  const q = (2n * abs + b) / (2n * b);
  return neg ? -q : q;
}

function toPlain(scaled: bigint): string {
  const s = scaled.toString().padStart(SCALE + 1, "0");
  const whole = s.slice(0, -SCALE);
  const frac = s.slice(-SCALE).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/**
 * Converts at the purchase-date rate (exact date, else nearest earlier = approximate).
 * Table rates are receipt-currency units per 1 home unit (cache.base = home); fxRate is the
 * inverse, home per receipt unit. Exact BigInt math, one rounding at the end.
 */
export function convertToHome(
  totalMinor: number,
  currency: string,
  home: string,
  purchaseDate: string,
  cache: FxCache,
): Conversion | null {
  if (currency.toUpperCase() === home.toUpperCase()) {
    return { amountHomeMinor: totalMinor, fxRate: "1", fxRateDate: purchaseDate, approximate: false };
  }
  if (cache.base !== home.toLowerCase()) return null;
  const code = currency.toLowerCase();

  let date: string | null = null;
  for (const d of Object.keys(cache.byDate)) {
    if (d <= purchaseDate && cache.byDate[d][code] !== undefined && (date === null || d > date)) date = d;
  }
  if (date === null) return null;
  const r = parseDecimal(cache.byDate[date][code]);
  if (!r) return null;

  const eR = currencyExponent(currency);
  const eH = currencyExponent(home);
  const D = 10n ** BigInt(r.k);
  // home minor = total * 10^eH / 10^eR / (n/D)
  const amount = divRound(BigInt(totalMinor) * 10n ** BigInt(eH) * D, r.n * 10n ** BigInt(eR));
  const fxRate = toPlain(divRound(D * 10n ** BigInt(SCALE), r.n));
  return {
    amountHomeMinor: Number(amount),
    fxRate,
    fxRateDate: date,
    approximate: date !== purchaseDate,
  };
}
