import type { OcrResult } from "../../modules/receipt-ocr/src/ReceiptOcr.types";
import { createPage } from "@/db/repositories/pages";
import { createReceipt } from "@/db/repositories/receipts";
import type { AppDb } from "@/db/types";
import { convertToHome, type Conversion } from "@/fx/convert";
import { ensureRates, type FxPass } from "@/fx/rates";
import type { ImageStore } from "@/images/store";
import { OCR_LANGUAGES } from "@/ocr/languages";
import { toLines } from "@/ocr/readingOrder";
import type { parseReceipt } from "@/parsing";
import { splitReceipts } from "@/parsing/heuristics/split";
import type { FieldConfidence, ParsedReceipt } from "@/parsing/types";
import type { FxCache, Language } from "@/prefs/prefs";

import { deviceTimeZone, formatLocal, localToUtc } from "./localTime";

/** Every native / IO dependency of the capture pipeline (fakes in tests). */
export type CaptureDeps = {
  db: AppDb;
  images: ImageStore;
  ocr: {
    recognizeText(uri: string, languages: string[]): Promise<OcrResult>;
    imageHash(uri: string): Promise<string>;
  };
  parse: typeof parseReceipt;
  /** FX table cache (prefs `fxTables`): read with get, persisted with set when ensureRates changed it. */
  fx: { get(): FxCache; set(cache: FxCache): void; fetchFn?: typeof fetch };
  home: string;
  uiLanguage: Language;
  clock: () => Date;
  /** Capture lease (Ruling I): held across every savePage + OCR call; returns its release. */
  lease: () => () => void;
  /** IANA zone for purchase/scan local times; defaults to the device zone. */
  timeZone?: string;
};

/** An encrypted page saved during analysis (its plaintext is already deleted). */
export type CapturedPage = { imagePath: string; thumbPath: string; width: number; height: number };

export type Analysis = {
  pages: CapturedPage[];
  /** dHash of the first page; null when hashing failed. */
  dhash: string | null;
  lines: string[];
  segments: string[][];
  splitReason: "single" | "repeated-header";
  ocrFailed: boolean;
};

/**
 * Encrypts and OCRs the pages of ONE receipt (scanner pages, or one imported photo).
 * Each source is saved with `savePage`; OCR and the dHash (first page) read the normalized
 * plaintext copy, which is deleted right after, and every source file (picker/scanner output)
 * is deleted at the end, success or not. The capture lease is held for the whole window.
 * OCR failure is not fatal: the result is `ocrFailed` with no lines (manual draft later).
 * A savePage failure deletes the pages already encrypted here and rethrows.
 */
export async function analyzeCapture(uris: string[], deps: CaptureDeps): Promise<Analysis> {
  const release = deps.lease();
  const pages: CapturedPage[] = [];
  const lines: string[] = [];
  let dhash: string | null = null;
  let ocrFailed = false;
  const languages = OCR_LANGUAGES(deps.uiLanguage);
  try {
    for (const [i, uri] of uris.entries()) {
      const saved = await deps.images.savePage(uri);
      pages.push({ imagePath: saved.imagePath, thumbPath: saved.thumbPath, width: saved.width, height: saved.height });
      try {
        if (!ocrFailed) {
          try {
            lines.push(...toLines((await deps.ocr.recognizeText(saved.normalizedUri, languages)).observations));
          } catch {
            ocrFailed = true;
          }
        }
        if (i === 0) {
          try {
            dhash = await deps.ocr.imageHash(saved.normalizedUri);
          } catch {
            dhash = null;
          }
        }
      } finally {
        await deps.images.discardPlaintext(saved.normalizedUri).catch(() => undefined);
      }
    }
  } catch (e) {
    await deps.images.deleteFiles(pages.flatMap((p) => [p.imagePath, p.thumbPath])).catch(() => undefined);
    throw e;
  } finally {
    for (const uri of uris) await deps.images.discardPlaintext(uri).catch(() => undefined);
    release();
  }

  if (ocrFailed) {
    return { pages, dhash, lines: [], segments: [[]], splitReason: "single", ocrFailed: true };
  }
  const split = splitReceipts(lines, { today: deps.clock() });
  return { pages, dhash, lines, segments: split.segments, splitReason: split.reason, ocrFailed: false };
}

/** Deletes the encrypted files of an analysis that never became drafts (user cancelled). */
export async function discardAnalysis(analysis: Analysis, deps: Pick<CaptureDeps, "images">): Promise<void> {
  await deps.images.deleteFiles(analysis.pages.flatMap((p) => [p.imagePath, p.thumbPath]));
}

const ZERO_CONFIDENCE: FieldConfidence = { merchant: 0, date: 0, total: 0, tax: 0, currency: 0, category: 0 };

type DraftFields = { parsed: ParsedReceipt; rawOcrText: string | null };

function manualParsed(currency: string): ParsedReceipt {
  return {
    merchant: null,
    purchasedDate: null,
    purchasedTime: null,
    currency,
    totalMinor: null,
    taxMinor: null,
    categoryId: null,
    refNo: null,
    confidence: { ...ZERO_CONFIDENCE },
    source: "manual",
  };
}

const minConfidence = (all: FieldConfidence[]): FieldConfidence =>
  Object.fromEntries(
    (Object.keys(ZERO_CONFIDENCE) as (keyof FieldConfidence)[]).map((k) => [k, Math.min(...all.map((c) => c[k]))]),
  ) as FieldConfidence;

/**
 * "Keep as one": totals (and taxes, when every segment has one) are summed when every segment
 * has a total in the same currency; otherwise the first segment's values are kept. Other fields
 * come from the first segment; each confidence is the lowest across segments.
 */
function combine(parts: ParsedReceipt[]): ParsedReceipt {
  const [first] = parts;
  const confidence = minConfidence(parts.map((p) => p.confidence));
  const summable = parts.every((p) => p.currency === first.currency && p.totalMinor !== null);
  if (!summable) return { ...first, confidence };
  const taxes = parts.map((p) => p.taxMinor);
  return {
    ...first,
    totalMinor: parts.reduce((s, p) => s + (p.totalMinor as number), 0),
    taxMinor: taxes.every((t) => t !== null) ? (taxes as number[]).reduce((s, t) => s + t, 0) : null,
    confidence,
  };
}

/** Parse result with nothing usable (no total, no date) becomes a manual draft. */
function orManual(p: ParsedReceipt, home: string): ParsedReceipt {
  return p.totalMinor === null && p.purchasedDate === null ? manualParsed(p.currency || home) : p;
}

async function parseSegment(lines: string[], deps: CaptureDeps, today: Date): Promise<ParsedReceipt> {
  try {
    const p = await deps.parse(lines, { homeCurrency: deps.home, locale: deps.uiLanguage, today });
    return orManual(p, deps.home);
  } catch {
    return manualParsed(deps.home);
  }
}

/**
 * Creates `status: 'draft'` receipts from an analysis: one per segment with "split", else one
 * (segments combined). Every draft gets its own page rows pointing at the same encrypted files
 * (dHash on page 0). Purchase time = parsed date + time (00:00 without a time) or the scan time,
 * in the device zone. Foreign totals are converted at the purchase-date rate after a best-effort
 * `ensureRates` (offline leaves FX fields null); the cache is persisted only when it changed.
 */
export async function createDrafts(
  analysis: Analysis,
  choice: "split" | "single",
  deps: CaptureDeps,
): Promise<string[]> {
  const scanned = deps.clock();
  const tz = deps.timeZone ?? deviceTimeZone();
  const scanLocal = formatLocal(scanned, tz);

  let drafts: DraftFields[];
  if (analysis.ocrFailed) {
    drafts = [{ parsed: manualParsed(deps.home), rawOcrText: null }];
  } else if (analysis.segments.length > 1 && choice === "split") {
    drafts = [];
    for (const seg of analysis.segments) {
      drafts.push({ parsed: await parseSegment(seg, deps, scanned), rawOcrText: seg.join("\n") });
    }
  } else if (analysis.segments.length > 1) {
    const parts: ParsedReceipt[] = [];
    for (const seg of analysis.segments) parts.push(await parseSegment(seg, deps, scanned));
    const parsedSource = parts.find((p) => p.source !== "manual")?.source ?? "manual";
    drafts = [{ parsed: { ...combine(parts), source: parsedSource }, rawOcrText: analysis.lines.join("\n") }];
  } else {
    drafts = [{ parsed: await parseSegment(analysis.lines, deps, scanned), rawOcrText: analysis.lines.join("\n") }];
  }

  const rows = drafts.map(({ parsed, rawOcrText }) => {
    const purchasedAtLocal = parsed.purchasedDate
      ? `${parsed.purchasedDate}T${parsed.purchasedTime ?? "00:00"}:00`
      : scanLocal;
    return { parsed, rawOcrText, purchasedAtLocal };
  });

  // FX: one sync pass for all drafts; the network is touched only for foreign totals.
  const initialFx = deps.fx.get();
  let fx = initialFx;
  const pass: FxPass = {};
  const conversions: (Conversion | null)[] = [];
  for (const { parsed, purchasedAtLocal } of rows) {
    if (parsed.totalMinor === null) {
      conversions.push(null);
      continue;
    }
    const date = purchasedAtLocal.slice(0, 10);
    if (parsed.currency.toUpperCase() !== deps.home.toUpperCase()) {
      try {
        fx = await ensureRates(fx, deps.home, date, scanned.getTime(), deps.fx.fetchFn, pass);
      } catch {
        // best effort: offline / malformed table leaves the draft unconverted
      }
    }
    try {
      conversions.push(convertToHome(parsed.totalMinor, parsed.currency, deps.home, date, fx));
    } catch {
      conversions.push(null); // unknown currency or non-integer amount
    }
  }
  if (fx !== initialFx) deps.fx.set(fx);

  const ids: string[] = [];
  deps.db.transaction((tx) => {
    const db = tx as unknown as AppDb;
    rows.forEach(({ parsed, rawOcrText, purchasedAtLocal }, i) => {
      const c = conversions[i];
      const receipt = createReceipt(db, {
        status: "draft",
        merchant: parsed.merchant,
        purchasedAtLocal,
        purchasedTz: tz,
        purchasedAtUtc: localToUtc(purchasedAtLocal, tz),
        scannedAtUtc: scanned.getTime(),
        scannedTz: tz,
        currency: parsed.currency,
        // Column is NOT NULL: 0 at confidence 0 means "unknown" (review requires a real total).
        totalMinor: parsed.totalMinor ?? 0,
        taxMinor: parsed.taxMinor,
        fxRate: c?.fxRate ?? null,
        fxRateDate: c?.fxRateDate ?? null,
        homeCurrencyAtSave: deps.home,
        amountHomeMinor: c?.amountHomeMinor ?? null,
        fxApproximate: c?.approximate ?? false,
        categoryId: parsed.categoryId,
        refNo: parsed.refNo,
        rawOcrText,
        parseSource: parsed.source,
        parseConfidence: JSON.stringify(parsed.confidence),
      });
      analysis.pages.forEach((p, pageIndex) =>
        createPage(db, {
          receiptId: receipt.id,
          pageIndex,
          imagePath: p.imagePath,
          thumbPath: p.thumbPath,
          width: p.width,
          height: p.height,
          dhash: pageIndex === 0 ? analysis.dhash : null,
        }),
      );
      ids.push(receipt.id);
    });
  });
  return ids;
}

export type CaptureRunHooks = {
  /** Asked when one capture holds several receipts; null = user cancelled the whole run. */
  chooseSplit(count: number): Promise<"split" | "single" | null>;
  onProgress?(index: number, total: number): void;
  isCancelled?(): boolean;
};

/**
 * Runs captures one after another (never in parallel: low-RAM devices). Each group is one
 * receipt's pages (scanner) or one imported photo. A failed group is counted and skipped. On
 * cancel, the current analysis' encrypted files and every remaining source file are deleted.
 */
export async function runCaptures(
  groups: string[][],
  deps: CaptureDeps,
  hooks: CaptureRunHooks,
): Promise<{ ids: string[]; failed: number; cancelled: boolean }> {
  const ids: string[] = [];
  let failed = 0;
  const dropRemaining = async (from: number) => {
    for (const uri of groups.slice(from).flat()) await deps.images.discardPlaintext(uri).catch(() => undefined);
  };
  for (const [i, group] of groups.entries()) {
    if (hooks.isCancelled?.()) {
      await dropRemaining(i);
      return { ids, failed, cancelled: true };
    }
    hooks.onProgress?.(i, groups.length);
    let analysis: Analysis;
    try {
      analysis = await analyzeCapture(group, deps);
    } catch {
      failed++;
      continue;
    }
    const choice = analysis.segments.length > 1 ? await hooks.chooseSplit(analysis.segments.length) : "split";
    if (choice === null || hooks.isCancelled?.()) {
      await discardAnalysis(analysis, deps).catch(() => undefined);
      await dropRemaining(i + 1);
      return { ids, failed, cancelled: true };
    }
    try {
      ids.push(...(await createDrafts(analysis, choice, deps)));
    } catch {
      await discardAnalysis(analysis, deps).catch(() => undefined);
      failed++;
    }
  }
  return { ids, failed, cancelled: false };
}
