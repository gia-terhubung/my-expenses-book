import type { NewReceiptInput, Receipt } from "@/db/types";
import { convertToHome, convertWithRate, type Conversion } from "@/fx/convert";
import { deviceTimeZone, localToUtc } from "@/capture/localTime";
import { CURRENCIES, currencyExponent } from "@/money/currencies";
import { fromMinor, toMinor } from "@/money/money";
import type { FieldConfidence } from "@/parsing/types";
import type { FxCache } from "@/prefs/prefs";

/** Editable review fields, kept as the strings the user typed. */
export type ReviewValues = {
  merchant: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (24h); empty = 00:00 */
  time: string;
  /** Decimal as typed ("25.000", "12,50"); empty = no total */
  total: string;
  currency: string;
  tax: string;
  categoryId: string | null;
  notes: string;
  /** Manual rate override (home units per 1 receipt unit); empty = automatic */
  fxRate: string;
  folderId: string | null;
};

export type ReviewField = keyof ReviewValues;

/** Validation messages are i18n keys. */
export type ReviewErrors = Partial<Record<ReviewField, string>>;

/** Which parse confidence a form field answers to. */
export const CONFIDENCE_OF: Partial<Record<ReviewField, keyof FieldConfidence>> = {
  merchant: "merchant",
  date: "date",
  time: "date",
  total: "total",
  tax: "tax",
  currency: "currency",
  categoryId: "category",
};

export const LOW_CONFIDENCE = 0.6;

const KNOWN = new Set(CURRENCIES.map((c) => c.code));
export const isKnownCurrency = (code: string) => KNOWN.has(code.toUpperCase());

export function parseConfidence(raw: string | null): FieldConfidence | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" ? (v as FieldConfidence) : null;
  } catch {
    return null;
  }
}

/**
 * Typed amount to minor units. Accepts "25.000", "1.234,56", "1,234.56", "12,5": the last `.`/`,`
 * is the decimal mark when 1..exponent digits follow it, every other `.`/`,`/space/' is a
 * thousands separator. Null when empty or malformed.
 */
export function parseAmountInput(text: string, currency: string): number | null {
  const s = text.trim().replace(/[\s'  ]/g, "");
  if (!s || !/^\d[\d.,]*$/.test(s) || /[.,]$/.test(s)) return null;
  const exponent = currencyExponent(currency);
  const last = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  let decimal: string;
  if (last >= 0 && exponent > 0 && s.length - last - 1 <= exponent) {
    decimal = `${s.slice(0, last).replace(/[.,]/g, "")}.${s.slice(last + 1)}`;
  } else {
    decimal = s.replace(/[.,]/g, "");
  }
  try {
    return toMinor(decimal, currency);
  } catch {
    return null;
  }
}

/** The decimal mark people write in `locale` ("," in es and pt-BR, "." in en). */
function decimalMark(locale: string | undefined): string {
  if (!locale) return ".";
  // format(), not formatToParts(): Hermes has no formatToParts (the review screen crashed).
  const mark = new Intl.NumberFormat(locale).format(1.5).replace(/\d/g, "");
  return mark === "," ? "," : ".";
}

/**
 * Minor units as an editable string in the app language's decimal mark; an all-zero fraction is
 * dropped ("25000", "12.50", es "23,45"). parseAmountInput reads every form back.
 */
export function amountText(minor: number, currency: string, locale?: string): string {
  return fromMinor(minor, currency).replace(/\.0+$/, "").replace(".", decimalMark(locale));
}

/** Positive plain decimal ("16250.5", "0,0067") normalised with a dot; null otherwise. */
export function parseRate(text: string): string | null {
  const s = text.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s) || !/[1-9]/.test(s)) return null;
  return s;
}

export function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function isValidTime(s: string): boolean {
  return s === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Form values for a stored receipt. Ruling X: a 0 total (unknown) shows as empty. */
export function valuesFromReceipt(r: Receipt, locale?: string): ReviewValues {
  return {
    merchant: r.merchant ?? "",
    date: r.purchasedAtLocal.slice(0, 10),
    time: r.purchasedAtLocal.slice(11, 16),
    total: r.totalMinor === 0 ? "" : amountText(r.totalMinor, r.currency, locale),
    currency: r.currency,
    tax: r.taxMinor === null ? "" : amountText(r.taxMinor, r.currency, locale),
    categoryId: r.categoryId,
    notes: r.notes ?? "",
    fxRate: r.fxRate !== null && r.fxRateDate === null ? r.fxRate : "",
    folderId: r.folderId,
  };
}

export function validate(v: ReviewValues): ReviewErrors {
  const e: ReviewErrors = {};
  if (!isKnownCurrency(v.currency)) {
    e.currency = "review.errors.currencyUnknown";
  } else {
    const total = parseAmountInput(v.total, v.currency);
    if (v.total.trim() === "") e.total = "review.errors.totalRequired";
    else if (total === null || total === 0) e.total = "review.errors.totalInvalid";
    if (v.tax.trim() !== "" && parseAmountInput(v.tax, v.currency) === null) e.tax = "review.errors.amountInvalid";
  }
  if (v.date.trim() === "") e.date = "review.errors.dateRequired";
  else if (!isValidDate(v.date)) e.date = "review.errors.dateInvalid";
  if (!isValidTime(v.time)) e.time = "review.errors.timeInvalid";
  if (v.fxRate.trim() !== "" && parseRate(v.fxRate) === null) e.fxRate = "review.errors.rateInvalid";
  return e;
}

export type FxPreview = {
  conversion: Pick<Conversion, "amountHomeMinor" | "fxRate" | "approximate"> & { fxRateDate: string | null };
  manual: boolean;
} | null;

/**
 * Home amount for the current values: the manual rate when one is entered (exact, no table
 * date), else the purchase-date table rate. Null when there is no total/rate or the currency is
 * unknown (convertToHome can throw).
 */
export function previewFx(v: ReviewValues, home: string, cache: FxCache): FxPreview {
  if (!isKnownCurrency(v.currency) || !isKnownCurrency(home)) return null;
  const total = parseAmountInput(v.total, v.currency);
  if (total === null || total === 0 || !isValidDate(v.date)) return null;
  const sameCurrency = v.currency.toUpperCase() === home.toUpperCase();
  const rate = sameCurrency ? null : parseRate(v.fxRate);
  if (rate) {
    const amount = convertWithRate(total, v.currency, home, rate);
    return amount === null
      ? null
      : { conversion: { amountHomeMinor: amount, fxRate: rate, fxRateDate: null, approximate: false }, manual: true };
  }
  try {
    const c = convertToHome(total, v.currency, home, v.date, cache);
    return c ? { conversion: c, manual: false } : null;
  } catch {
    return null;
  }
}

/**
 * Draft columns for the current values. Fields that don't parse yet (half-typed date, bad
 * amount) are left out, so the stored draft keeps its last valid value; an emptied total is
 * stored as 0 (Ruling X: unknown).
 */
export function draftPatch(r: Receipt, v: ReviewValues, home: string, cache: FxCache): Partial<NewReceiptInput> {
  const patch: Partial<NewReceiptInput> = {
    merchant: v.merchant.trim() || null,
    notes: v.notes.trim() || null,
    categoryId: v.categoryId,
    folderId: v.folderId,
  };
  if (isKnownCurrency(v.currency)) {
    patch.currency = v.currency.toUpperCase();
    if (v.total.trim() === "") patch.totalMinor = 0;
    else {
      const total = parseAmountInput(v.total, v.currency);
      if (total !== null) patch.totalMinor = total;
    }
    if (v.tax.trim() === "") patch.taxMinor = null;
    else {
      const tax = parseAmountInput(v.tax, v.currency);
      if (tax !== null) patch.taxMinor = tax;
    }
  }
  if (isValidDate(v.date) && isValidTime(v.time)) {
    const local = `${v.date}T${v.time || "00:00"}:00`;
    patch.purchasedAtLocal = local;
    patch.purchasedAtUtc = localToUtc(local, r.purchasedTz ?? deviceTimeZone());
  }
  const fx = previewFx(v, home, cache);
  patch.fxRate = fx?.conversion.fxRate ?? null;
  patch.fxRateDate = fx?.conversion.fxRateDate ?? null;
  patch.amountHomeMinor = fx?.conversion.amountHomeMinor ?? null;
  patch.fxApproximate = fx?.conversion.approximate ?? false;
  patch.homeCurrencyAtSave = home;
  return patch;
}
