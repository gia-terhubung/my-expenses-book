import { currencyExponent } from "@/money/currencies";
import type { Language } from "@/prefs/prefs";

export const SUPPORTED_LANGUAGES: readonly Language[] = ["en", "id", "es", "pt-BR"];

function matchLocale(tag: string, code: string | null): Language | null {
  const exact = SUPPORTED_LANGUAGES.find((l) => l.toLowerCase() === tag.toLowerCase());
  if (exact) return exact;
  const lang = (code ?? tag.split(/[-_]/)[0]).toLowerCase();
  if (lang === "pt") return "pt-BR";
  if (lang === "in" || lang === "id") return "id"; // legacy Android code "in"
  if (lang === "es") return "es";
  if (lang === "en") return "en";
  return null;
}

/** First device locale (in preference order) we support; otherwise English. */
export function resolveLanguage(
  deviceLocales: { languageTag: string; languageCode: string | null }[],
): Language {
  for (const l of deviceLocales) {
    const m = matchLocale(l.languageTag, l.languageCode);
    if (m) return m;
  }
  return "en";
}

export function resolveHomeCurrency(deviceLocales: { currencyCode: string | null }[]): string {
  for (const l of deviceLocales) {
    const code = l.currencyCode;
    if (!code) continue;
    try {
      currencyExponent(code);
      return code;
    } catch {
      // unknown code: try the next locale
    }
  }
  return "USD";
}

const TAX_YEAR_START: Record<string, number> = { GB: 4, AU: 7, NZ: 4, IN: 4 };

export function defaultTaxYearStartMonth(regionCode: string | null): number {
  return (regionCode && TAX_YEAR_START[regionCode.toUpperCase()]) || 1;
}
