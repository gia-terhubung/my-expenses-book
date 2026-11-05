import { toMinor } from "@/money/money";

import type { ParsedReceipt } from "../types";
import { findAmounts, type FoundAmount } from "./amount";
import { detectCurrency } from "./currency";
import { dateOrderFor, findDates, type DateOrder, type FoundDate } from "./date";
import {
  BANK_BRANDS,
  CATEGORY_RULES,
  LANGUAGE_CURRENCY,
  MERCHANT_LABEL,
  MERCHANT_SKIP,
  INCLUDED_AFTER,
  NEGATIVE_NOT_SPEND,
  NON_MONEY_LINE,
  REF_LABELS,
  REFUND_WORDS,
  RETAIL_BRANDS,
  TAX_KEYWORD,
  TAX_REGISTRATION,
  TOTAL_SKIP,
  TOTAL_SKIP_CJK,
  TOTAL_SKIP_QUALIFIER,
  TOTAL_SOFT_PAYMENT,
  TOTAL_SOFT_TAX,
  TOTAL_TIERS,
  WAYBILL,
} from "./keywords";

type Amount = FoundAmount & { end: number; money: boolean; currency: boolean };
type Line = { text: string; dates: FoundDate[]; amounts: Amount[] };

const SUFFIX_CURRENCY = /^\s?(?:€|EUR|USD|IDR|đ|₫|円|THB|฿|VND|GBP|£|R\$|RM)(?![\p{L}])/iu;
const TIME_RE = /(?<!\d)\d{1,2}:\d{2}(?::\d{2})?(?!\d)/g;
const LABELED_TIME_RE =
  /(?:jam|pukul|waktu|time|hora|heure|uhrzeit|giờ)\s*:?\s*(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?(?!\d)/giu;

/**
 * Phone and account numbers formatted with separators ("0812.3456.7890"): a leading 0 with
 * 9+ digits, or digit groups that are not thousands groups (a 4-digit group after the first).
 */
function phoneLike(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (/^0/.test(digits) && digits.length >= 9) return true;
  const groups = raw.replace(/[^\d.,\s]/g, "").trim().split(/[.,]\s?|\s+/).filter(Boolean);
  if (groups.length < 3) return false;
  return groups.slice(1, -1).some((g) => g.length !== 3) || groups[0]!.length > 3;
}

const mask = (s: string, from: number, to: number) => s.slice(0, from) + " ".repeat(to - from) + s.slice(to);

/** Amounts on a line, ignoring digits that belong to dates, times and percentages. */
function analyseLine(text: string, order: DateOrder, today: Date): Line {
  const dates = findDates(text, { order, today });
  let masked = text;
  for (const d of dates) masked = mask(masked, d.start, d.end);
  for (const re of [TIME_RE, LABELED_TIME_RE]) {
    for (const m of [...masked.matchAll(re)]) masked = mask(masked, m.index!, m.index! + m[0].length);
  }
  const amounts: Amount[] = [];
  const nonMoneyLine = NON_MONEY_LINE.test(text);
  for (const a of findAmounts(masked)) {
    const offset = masked.indexOf(a.raw, a.start);
    const end = (offset < 0 ? a.start : offset) + a.raw.length;
    const after = masked.slice(end);
    if (/^\s?%/.test(after)) continue;
    if (!/[1-9]/.test(a.value)) continue;
    const digits = a.raw.replace(/\D/g, "");
    const currency = /[^\d.,\s()\-−–]/.test(a.raw) || SUFFIX_CURRENCY.test(after);
    const separated = /\d[.,]\s?\d/.test(a.raw);
    const money =
      digits.length <= 13 &&
      !phoneLike(a.raw) &&
      (currency || (!nonMoneyLine && (separated || (digits.length >= 3 && digits.length <= 7))));
    amounts.push({ ...a, end, money, currency });
  }
  return { text, dates, amounts };
}

/** End of a total keyword that leads the line (nothing but punctuation before it), else -1. */
function leadingTotalEnd(text: string): number {
  for (const t of TOTAL_TIERS) {
    const m = t.re.exec(text);
    if (m && !/[\p{L}\p{N}]/u.test(text.slice(0, m.index))) return m.index + m[0].length;
  }
  return -1;
}

const whole = (re: RegExp, s: string) => {
  const m = re.exec(s);
  return m !== null && m.index === 0 && m[0].length === s.length;
};

/**
 * True when a skip word labels the line. Not when it qualifies the total:
 * "TOTAL incl. VAT", "Total with tip", "TOTAL (TAX INCLUDED)", "Total Bayar Cash".
 * "TOTAL TAX" and "TOTAL HT" still skip.
 */
function skipsTotal(text: string): boolean {
  if (TOTAL_SKIP_CJK.test(text)) return true;
  const kwEnd = leadingTotalEnd(text);
  const re = new RegExp(TOTAL_SKIP.source, TOTAL_SKIP.flags.replace("g", "") + "g");
  return [...text.matchAll(re)].some((m) => {
    const at = m.index!;
    if (TOTAL_SKIP_QUALIFIER.test(text.slice(0, at))) return false;
    if (kwEnd < 0 || at < kwEnd) return true;
    if (whole(TOTAL_SOFT_PAYMENT, m[0])) return false;
    if (!whole(TOTAL_SOFT_TAX, m[0])) return true;
    const between = text.slice(kwEnd, at);
    const inParens = between.lastIndexOf("(") > between.lastIndexOf(")");
    // "TOTAL TAX", "Total Sales Tax": a tax total, not the grand total.
    return !(inParens || INCLUDED_AFTER.test(text.slice(at + m[0].length)));
  });
}

type TotalPick = { value: string; confidence: number };

function pickTotal(lines: Line[]): TotalPick | null {
  // rank = 2 * tier, +1 when the amount comes from a following line; lower wins, ties keep the first.
  let best: { value: string; confidence: number; rank: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (skipsTotal(line.text)) continue;
    const tier = TOTAL_TIERS.findIndex((t) => t.re.test(line.text));
    if (tier < 0 || (best && best.rank <= tier * 2)) continue;
    const m = TOTAL_TIERS[tier]!.re.exec(line.text)!;
    const kwEnd = m.index + m[0].length;
    let amount = [...line.amounts].reverse().find((a) => isPositiveMoney(a) && a.start >= kwEnd);
    let rank = tier * 2;
    for (let j = i + 1; !amount && j <= i + 2 && j < lines.length; j++) {
      const next = lines[j]!;
      if (skipsTotal(next.text)) break;
      amount = next.amounts.find(isPositiveMoney);
      rank = tier * 2 + 1;
    }
    if (amount && (!best || rank < best.rank)) {
      best = { value: amount.value, confidence: TOTAL_TIERS[tier]!.confidence, rank };
    }
  }
  if (best) return { value: best.value, confidence: best.confidence };
  // Fallback: largest currency-marked (else separator-formatted) amount on a non-skip line.
  const pool = lines.filter((l) => !skipsTotal(l.text)).flatMap((l) => l.amounts.filter(isPositiveMoney));
  const marked = pool.filter((a) => a.currency);
  const candidates = marked.length ? marked : pool.filter((a) => /[.,]/.test(a.raw));
  if (candidates.length) return { value: largest(candidates).value, confidence: 0.3 };
  return debitOnlyTotal(lines);
}

const isPositiveMoney = (a: Amount) => a.money && !a.negative;

const largest = (xs: Amount[]) => xs.reduce((x, y) => (Number(y.value) > Number(x.value) ? y : x));

/**
 * A bank-mutation style record prints the spend as a negative amount ("-Rp461.000").
 * Only when every money amount is negative, and the line is not a refund/discount/change
 * line, is the absolute value used as the total.
 */
function debitOnlyTotal(lines: Line[]): TotalPick | null {
  const all = lines.flatMap((l) => l.amounts.filter((a) => a.money).map((a) => ({ a, line: l.text })));
  if (!all.length || all.some(({ a }) => !a.negative)) return null;
  if (lines.some((l) => REFUND_WORDS.test(l.text))) return null;
  const spend = all.filter(({ line }) => !NEGATIVE_NOT_SPEND.test(line)).map(({ a }) => a);
  return spend.length ? { value: largest(spend).value, confidence: 0.6 } : null;
}

function pickTax(lines: Line[], currency: string, totalMinor: number | null): number | null {
  let sum: number | null = null;
  for (const line of lines) {
    const kws = [...line.text.matchAll(TAX_KEYWORD)];
    if (!kws.length || TAX_REGISTRATION.test(line.text)) continue;
    const last = kws[kws.length - 1]!;
    const after = last.index! + last[0].length;
    const amount = [...line.amounts].reverse().find((a) => isPositiveMoney(a) && a.start >= after);
    if (!amount) continue;
    sum = (sum ?? 0) + toMinor(amount.value, currency);
  }
  if (sum === null || (totalMinor !== null && sum >= totalMinor)) return null;
  return sum;
}

const DATE_LABEL =
  /(?:date|datum|tanggal|tgl|fecha|data|ngày|date\s+of\s+issue|rechnungsdatum)\s*[:.]?\s*$/iu;

function isFuture(date: string, today: Date) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Date.UTC(y, m - 1, d) - todayUtc > 86400000;
}

function pickDate(lines: Line[], order: DateOrder, today: Date): FoundDate | null {
  let best: { d: FoundDate; score: number; line: string } | null = null;
  for (const line of lines) {
    for (const d of line.dates) {
      const labeled = DATE_LABEL.test(line.text.slice(0, d.start));
      const score = d.confidence + (labeled ? 0.2 : 0);
      if (!best || score > best.score) best = { d, score, line: line.text };
    }
  }
  if (!best) return null;
  if (isFuture(best.d.date, today) && order !== "YMD") {
    // An ambiguous numeric date that lands in the future is probably in the other order.
    const alt = findDates(best.line, { order: order === "MDY" ? "DMY" : "MDY", today }).find(
      (d) => d.start === best!.d.start && !isFuture(d.date, today),
    );
    if (alt) return { ...alt, confidence: Math.min(alt.confidence, 0.6) };
  }
  return best.d;
}

function pickTime(lines: Line[], date: FoundDate | null): string | null {
  if (date?.time) return date.time;
  for (const line of lines) {
    for (const m of line.text.matchAll(LABELED_TIME_RE)) {
      const h = Number(m[1]);
      const mi = Number(m[2]);
      if (h < 24 && mi < 60) return `${m[1]!.padStart(2, "0")}:${m[2]}`;
    }
  }
  return null;
}

const REF_TOKEN = /[A-Z0-9][A-Z0-9\-/]{3,}/iu;

function refFrom(text: string): string | null {
  // Allow one digit-free word between label and value ("ID Transaksi Gojek F-123…").
  const m = /^\s*[:#.]?\s*(?:[\p{L}]+\s+)?([A-Z0-9][A-Z0-9\-/]{3,})(\.{2,}|…)?/iu.exec(text);
  if (!m || m[2] || !/\d/.test(m[1]!)) return null;
  return m[1]!.replace(/[-/]+$/, "");
}

function pickRef(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    for (const label of REF_LABELS) {
      const m = label.exec(lines[i]!);
      if (!m) continue;
      const rest = lines[i]!.slice(m.index + m[0].length);
      const own = refFrom(rest);
      if (own) return own;
      if (/^\s*[:#.]?\s*$/.test(rest) && i + 1 < lines.length) {
        const next = REF_TOKEN.exec(lines[i + 1]!.trim());
        if (next && /\d/.test(next[0])) return next[0].replace(/[-/]+$/, "");
      }
    }
  }
  return lines.map((l) => l.trim()).find((l) => WAYBILL.test(l)) ?? null;
}

function pickCategory(text: string): string | null {
  return CATEGORY_RULES.find((r) => r.re.test(text))?.id ?? null;
}

function firstBrand(lines: string[], brands: { re: RegExp; name: string }[]): string | null {
  for (const line of lines) {
    let hit: { at: number; name: string } | null = null;
    for (const b of brands) {
      const m = b.re.exec(line);
      if (m && (!hit || m.index < hit.at)) hit = { at: m.index, name: b.name };
    }
    if (hit) return hit.name;
  }
  return null;
}

function cleanMerchant(line: string): string {
  return line
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .split(/,|\s{2,}|\s[|·]\s/)[0]!
    .replace(/\s+#?\d+$/u, "")
    .replace(/\s+\S*店$/u, "")
    .replace(/\s+(?:ltda|pt|tbk|inc|llc|ltd|gmbh|srl|snc)\.?$/iu, "")
    .trim();
}

function pickMerchant(lines: string[], category: string | null): { name: string; confidence: number } | null {
  for (const line of lines) {
    const m = MERCHANT_LABEL.exec(line);
    if (m && (m[1]!.match(/\p{L}/gu)?.length ?? 0) >= 3) return { name: m[1]!.trim(), confidence: 0.8 };
  }
  if (category === "default:transfer") {
    const bank = firstBrand(lines, BANK_BRANDS);
    if (bank) return { name: bank, confidence: 0.7 };
  }
  const retail = firstBrand(lines, RETAIL_BRANDS);
  if (retail) return { name: retail, confidence: 0.7 };
  for (const line of lines) {
    const letters = line.match(/\p{L}/gu)?.length ?? 0;
    if (letters < 3) continue;
    if (/^\s*[<•]?\s*\d{1,2}[:.]\d{2}(?!\d)/u.test(line)) continue; // status bar
    if (MERCHANT_SKIP.test(line)) continue;
    if (/^[\p{L}\s.]{2,30}:/u.test(line)) continue; // "Label: value"
    const name = cleanMerchant(line);
    if ((name.match(/\p{L}/gu)?.length ?? 0) >= 3) return { name, confidence: 0.5 };
  }
  return null;
}

function pickCurrency(text: string, home: string): { code: string; confidence: number } {
  const found = detectCurrency(text, home);
  if (found.confidence > 0) return found;
  const lang = LANGUAGE_CURRENCY.find((h) => h.re.test(text));
  return lang ? { code: lang.code, confidence: 0.3 } : found;
}

export function parseHeuristic(
  rawLines: string[],
  hints: { homeCurrency: string; today: Date },
): ParsedReceipt {
  const texts = rawLines.map((l) => l.trim()).filter((l) => l.length > 0);
  const all = texts.join("\n");
  const currency = pickCurrency(all, hints.homeCurrency);
  const order = dateOrderFor(currency.code);
  const lines = texts.map((t) => analyseLine(t, order, hints.today));

  const total = pickTotal(lines);
  const date = pickDate(lines, order, hints.today);
  const totalMinor = total ? toMinor(total.value, currency.code) : null;

  if (!total && !date) {
    return {
      merchant: null,
      purchasedDate: null,
      purchasedTime: null,
      currency: currency.code,
      totalMinor: null,
      taxMinor: null,
      categoryId: null,
      refNo: null,
      confidence: { merchant: 0, date: 0, total: 0, tax: 0, currency: currency.confidence, category: 0 },
      source: "heuristic",
    };
  }

  const taxMinor = pickTax(lines, currency.code, totalMinor);
  const categoryId = pickCategory(all);
  const merchant = pickMerchant(texts, categoryId);
  return {
    merchant: merchant?.name ?? null,
    purchasedDate: date?.date ?? null,
    purchasedTime: pickTime(lines, date),
    currency: currency.code,
    totalMinor,
    taxMinor,
    categoryId,
    refNo: pickRef(texts),
    confidence: {
      merchant: merchant?.confidence ?? 0,
      date: date?.confidence ?? 0,
      total: total?.confidence ?? 0,
      tax: taxMinor === null ? 0 : 0.7,
      currency: currency.confidence,
      category: categoryId ? 0.6 : 0,
    },
    source: "heuristic",
  };
}

/** Total of a block of lines as a major-unit decimal string (currency-agnostic); used by split detection. */
export function extractTotalValue(rawLines: string[], today: Date): string | null {
  const lines = rawLines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((t) => analyseLine(t, "DMY", today));
  return pickTotal(lines)?.value ?? null;
}
