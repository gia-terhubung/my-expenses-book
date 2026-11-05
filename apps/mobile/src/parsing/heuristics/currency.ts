import { CURRENCIES } from "../../money/currencies";

const L = "(?<![\\p{L}])";
const SPECIFIC: [RegExp, string, number][] = [
  [/(?<![\p{L}])S\$/u, "SGD", 0.9],
  [/(?<![\p{L}])A\$|(?<![\p{L}])AU\$/u, "AUD", 0.9],
  [/(?<![\p{L}])R\$/u, "BRL", 0.9],
  [/(?<![\p{L}])US\$/u, "USD", 0.9],
  [/(?<![\p{L}])C\$|(?<![\p{L}])CA\$/u, "CAD", 0.9],
  [/(?<![\p{L}])HK\$/u, "HKD", 0.9],
  [/(?<![\p{L}])NT\$/u, "TWD", 0.9],
  [new RegExp(`${L}RM\\s?\\d`, "u"), "MYR", 0.9],
  [new RegExp(`${L}Rp\\.?(?![\\p{L}])`, "iu"), "IDR", 0.9],
  [/€/u, "EUR", 0.9],
  [/£/u, "GBP", 0.9],
  [/[¥円]/u, "JPY", 0.9],
  [/฿/u, "THB", 0.9],
  [/₫/u, "VND", 0.9],
  [/₩/u, "KRW", 0.9],
  [/₹/u, "INR", 0.9],
];
const BARE_DOLLAR = /(?<![\p{L}])\$/u;
const COMMON = new Set(["IDR", "USD", "EUR", "GBP", "JPY", "SGD", "MYR", "THB", "VND", "AUD", "CNY", "BRL"]);
const VALID = new Set(CURRENCIES.map((c) => c.code));

export function detectCurrency(
  text: string,
  fallback: string,
): { code: string; confidence: number } {
  const score = new Map<string, { conf: number; n: number }>();
  const add = (code: string, conf: number, n: number) => {
    const cur = score.get(code);
    if (!cur) score.set(code, { conf, n });
    else score.set(code, { conf: Math.max(cur.conf, conf), n: cur.n + n });
  };
  for (const [re, code, conf] of SPECIFIC) {
    const g = new RegExp(re.source, re.flags + "g");
    const n = [...text.matchAll(g)].length;
    if (n) add(code, conf, n);
  }
  for (const m of text.matchAll(/(?<![\p{L}])([A-Z]{3})(?![\p{L}])/gu)) {
    const code = m[1]!;
    if (!VALID.has(code)) continue;
    const i = m.index ?? 0;
    const near =
      /\d\s*$/.test(text.slice(Math.max(0, i - 3), i)) ||
      /^\s*\d/.test(text.slice(i + 3, i + 6));
    if (near || COMMON.has(code)) add(code, 0.95, 1);
  }
  if (!score.has("USD") && BARE_DOLLAR.test(text)) {
    const hasDollarVariant = [...score.keys()].some((c) => ["SGD", "AUD", "BRL", "CAD", "HKD", "TWD"].includes(c));
    if (!hasDollarVariant) add("USD", 0.6, 1);
  }
  let best: { code: string; conf: number; n: number } | null = null;
  for (const [code, s] of score) {
    if (!best || s.conf > best.conf || (s.conf === best.conf && s.n > best.n)) {
      best = { code, ...s };
    }
  }
  return best ? { code: best.code, confidence: best.conf } : { code: fallback, confidence: 0 };
}
