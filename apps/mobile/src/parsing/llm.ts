import { z } from "zod";

import type { ParseSource } from "@/db/schema";
import { currencyExponent } from "@/money/currencies";
import { toMinor } from "@/money/money";

import { findAmounts } from "./heuristics/amount";
import { dateOrderFor, findDates } from "./heuristics/date";
import type { ParsedReceipt } from "./types";

const llmSchema = z.object({
  merchant: z.string().optional(),
  purchasedAt: z.string().optional(),
  total: z.union([z.string(), z.number()]).optional(),
  tax: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
});

function extractJson(raw: string): unknown {
  const stripped = raw.replace(/```(?:json)?/gi, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

const MAX_MAJOR = 1e12;
const MERCHANT_MAX = 80;

function cleanMerchant(raw: string | undefined): string | null {
  if (!raw) return null;
  // eslint-disable-next-line no-control-regex
  const t = raw.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, MERCHANT_MAX).trim();
  return t || null;
}

function knownCurrency(code: string | undefined): string | null {
  const c = code?.trim().toUpperCase();
  if (!c || !/^[A-Z]{3}$/.test(c)) return null;
  try {
    currencyExponent(c);
    return c;
  } catch {
    return null;
  }
}

/** Positive amount in minor units, null when absent, undefined when invalid (negative/garbage). */
function amountMinor(value: string | number | undefined, currency: string): number | null | undefined {
  if (value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || (value > 0 && value < 0.001) || value > MAX_MAJOR) return undefined;
    value = value.toFixed(6);
  }
  const text = value.trim();
  if (text === "") return null;
  const found = findAmounts(text)[0];
  if (!found || found.negative) return undefined;
  try {
    const minor = toMinor(found.value, currency);
    return minor > 0 ? minor : null;
  } catch {
    return undefined;
  }
}

/**
 * Validate raw LLM text. Returns only fields that survived validation, or null
 * when the output is unusable (no JSON, wrong shape, negative amount, nothing valid).
 */
export function parseLlmOutput(
  raw: string,
  homeCurrency: string,
  today: Date = new Date(),
): Partial<ParsedReceipt> | null {
  const json = extractJson(raw);
  if (json === undefined) return null;
  const parsed = llmSchema.safeParse(json);
  if (!parsed.success) return null;
  const v = parsed.data;

  const currency = knownCurrency(v.currency);
  const amountCurrency = currency ?? homeCurrency;

  const total = amountMinor(v.total, amountCurrency);
  const tax = amountMinor(v.tax, amountCurrency);
  if (total === undefined || tax === undefined) return null;
  if (total !== null && tax !== null && tax > total) return null;

  const out: Partial<ParsedReceipt> = {};
  const merchant = cleanMerchant(v.merchant);
  if (merchant) out.merchant = merchant;
  if (currency) out.currency = currency;
  if (total !== null) out.totalMinor = total;
  if (tax !== null) out.taxMinor = tax;

  const at = v.purchasedAt?.trim();
  if (at) {
    const d = findDates(at, { order: dateOrderFor(amountCurrency), today })[0];
    if (d && d.confidence >= 0.5) {
      out.purchasedDate = d.date;
      if (d.time) out.purchasedTime = d.time;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

const LLM_MERCHANT_CONF = 0.7;
const LLM_CATEGORY_CONF = 0.6;
const DISAGREE_LLM_CONF = 0.5;
const AGREE_CONF = 0.95;

export function mergeParsed(
  heur: ParsedReceipt,
  llm: Partial<ParsedReceipt> | null,
  engine: ParseSource = "gemini_nano",
): ParsedReceipt {
  if (!llm) return heur;
  const out: ParsedReceipt = { ...heur, confidence: { ...heur.confidence } };
  let used = false;

  if (llm.merchant && heur.confidence.merchant < 0.6) {
    out.merchant = llm.merchant;
    out.confidence.merchant = LLM_MERCHANT_CONF;
    used = true;
  }
  if (llm.categoryId && heur.confidence.category < 0.6) {
    out.categoryId = llm.categoryId;
    out.confidence.category = LLM_CATEGORY_CONF;
    used = true;
  }

  const sameCurrency = !llm.currency || llm.currency === heur.currency;

  if (llm.totalMinor != null) {
    if (sameCurrency && heur.totalMinor === llm.totalMinor) {
      out.confidence.total = AGREE_CONF;
    } else if (heur.totalMinor == null || heur.confidence.total < 0.8) {
      out.totalMinor = llm.totalMinor;
      out.confidence.total = DISAGREE_LLM_CONF;
      if (llm.currency) {
        out.currency = llm.currency;
        out.confidence.currency = DISAGREE_LLM_CONF;
      }
      used = true;
    }
  }

  if (llm.taxMinor != null && sameCurrency) {
    if (heur.taxMinor === llm.taxMinor) {
      out.confidence.tax = AGREE_CONF;
    } else if (heur.taxMinor == null) {
      out.taxMinor = llm.taxMinor;
      out.confidence.tax = DISAGREE_LLM_CONF;
      used = true;
    }
  }

  if (llm.purchasedDate) {
    if (heur.purchasedDate === llm.purchasedDate) {
      out.confidence.date = AGREE_CONF;
      if (!heur.purchasedTime && llm.purchasedTime) {
        out.purchasedTime = llm.purchasedTime;
        used = true;
      }
    } else if (heur.purchasedDate == null || heur.confidence.date < 0.8) {
      out.purchasedDate = llm.purchasedDate;
      out.purchasedTime = llm.purchasedTime ?? null;
      out.confidence.date = DISAGREE_LLM_CONF;
      used = true;
    }
  }

  if (used) out.source = engine;
  return out;
}
