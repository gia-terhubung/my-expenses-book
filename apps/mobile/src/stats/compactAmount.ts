import { currencyExponent } from "@/money/currencies";
import { formatMoney } from "@/money/money";

// Building Intl formatters is slow on Hermes; chart axes format many labels.
const compactFormats = new Map<string, Intl.NumberFormat | null>();

const THRESHOLDS = [1e12, 1e9, 1e6, 1e3] as const;
// Largest first, matching THRESHOLDS.
const SUFFIXES: Record<string, readonly string[]> = {
  id: ["T", "M", "jt", "rb"],
  en: ["T", "B", "M", "K"],
  es: ["B", "mil M", "M", "mil"],
  pt: ["tri", "bi", "mi", "mil"],
};

/** Intl compact currency formatter, or null when this runtime lacks compact notation. */
function compactFormat(locale: string, currency: string): Intl.NumberFormat | null {
  const key = `${locale}|${currency}`;
  if (compactFormats.has(key)) return compactFormats.get(key) ?? null;
  let fmt: Intl.NumberFormat | null;
  try {
    fmt = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1, style: "currency", currency });
    // Some engines (Hermes) accept the option, may even echo it in resolvedOptions, and still print
    // the full amount: probe the output too. The full 1,234,567 has 7 digits; compact has far fewer.
    if (fmt.resolvedOptions().notation !== "compact" || fmt.format(1234567).replace(/\D/g, "").length >= 7) fmt = null;
  } catch {
    fmt = null;
  }
  compactFormats.set(key, fmt);
  return fmt;
}

const symbols = new Map<string, string>();

/** The currency's symbol in this locale ("Rp", "$", "R$"), cached per locale and currency. */
export function currencySymbol(locale: string, currency: string): string {
  const key = `${locale}|${currency}`;
  let symbol = symbols.get(key);
  if (symbol === undefined) {
    const part = new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency");
    symbol = part?.value ?? currency;
    symbols.set(key, symbol);
  }
  return symbol;
}

const plainFormats = new Map<string, Intl.NumberFormat>();

/** Hand-rolled compact form for runtimes without Intl compact notation: "Rp 31,3 jt", "$ 12.4 K". */
function fallback(major: number, minor: number, currency: string, locale: string): string {
  const abs = Math.abs(major);
  let i = THRESHOLDS.findIndex((t) => abs >= t);
  if (i < 0) return formatMoney(minor, currency, locale);
  // 999,950 rounds to "1.000 rb": move up a band so it reads "1 jt".
  if (i > 0 && Math.round((abs / THRESHOLDS[i]) * 10) / 10 >= 1000) i -= 1;
  const suffixes = SUFFIXES[locale.split("-")[0]] ?? SUFFIXES.en;
  let plain = plainFormats.get(locale);
  if (!plain) {
    plain = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    plainFormats.set(locale, plain);
  }
  const n = plain.format(major / THRESHOLDS[i]);
  return `${currencySymbol(locale, currency)} ${n} ${suffixes[i]}`;
}

/** Locale-aware short money label ("Rp 31,3 jt", "¥1.2M", "R$ 3,1 mi"), at most one decimal. Display only. */
export function compactAmount(minor: number, currency: string, locale: string): string {
  const major = minor / 10 ** currencyExponent(currency);
  const fmt = compactFormat(locale, currency);
  return fmt ? fmt.format(major) : fallback(major, minor, currency, locale);
}
