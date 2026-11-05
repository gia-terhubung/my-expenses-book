import { listPageHashes } from "@/db/repositories/pages";
import { findReceiptsByAmount, findReceiptsByRefNo, getReceipt } from "@/db/repositories/receipts";
import type { AppDb, Receipt } from "@/db/types";
import { hamming } from "@/ocr/dhash";

export type DuplicateMatch = { receiptId: string; strength: "exact-ref" | "same-image" | "similar" };

export const DHASH_MAX_DISTANCE = 6;
const MERCHANT_MIN_JACCARD = 0.5;
const DAY_MS = 86_400_000;
// Wide UTC prefilter; the ±1 day rule is applied to the local purchase dates below.
const UTC_WINDOW_MS = 3 * DAY_MS;

/** Lowercase letter/digit tokens with diacritics stripped. */
function tokens(s: string): Set<string> {
  return new Set(
    s
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  );
}

/** Jaccard similarity of merchant tokens; null when either side has none (test skipped). */
function merchantSimilarity(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return null;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/** Whole days between two `YYYY-MM-DD…` local timestamps. */
function dayDistance(a: string, b: string): number {
  const d = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  return Math.abs(d(a) - d(b)) / DAY_MS;
}

function within(hash: string, pageHashes: string[]): boolean {
  return pageHashes.some((h) => {
    try {
      return hamming(hash, h) <= DHASH_MAX_DISTANCE;
    } catch {
      return false; // malformed / different-length hash
    }
  });
}

/**
 * Confirmed receipts that may duplicate `r`, strongest first: same reference number, a page
 * image within dHash distance 6, then same currency + total + purchase date ±1 day + similar
 * merchant (token Jaccard >= 0.5; skipped when either merchant is null). Each receipt appears
 * once, at its strongest match. Excludes `r` itself, soft-deleted receipts and drafts.
 */
export function findDuplicates(db: AppDb, r: Receipt, pageHashes: string[]): DuplicateMatch[] {
  const out: DuplicateMatch[] = [];
  const seen = new Set<string>([r.id]);
  const add = (c: Receipt | null, strength: DuplicateMatch["strength"]) => {
    if (!c || seen.has(c.id) || c.status !== "confirmed" || c.deletedAt !== null) return;
    seen.add(c.id);
    out.push({ receiptId: c.id, strength });
  };

  if (r.refNo) {
    for (const c of findReceiptsByRefNo(db, r.refNo, r.id)) add(c, "exact-ref");
  }

  if (pageHashes.length) {
    const ids = new Set<string>();
    for (const p of listPageHashes(db)) {
      if (!seen.has(p.receiptId) && within(p.dhash, pageHashes)) ids.add(p.receiptId);
    }
    for (const id of ids) add(getReceipt(db, id), "same-image");
  }

  const candidates = findReceiptsByAmount(db, {
    currency: r.currency,
    totalMinor: r.totalMinor,
    fromUtc: r.purchasedAtUtc - UTC_WINDOW_MS,
    toUtc: r.purchasedAtUtc + UTC_WINDOW_MS,
    excludeId: r.id,
  });
  for (const c of candidates) {
    if (dayDistance(c.purchasedAtLocal, r.purchasedAtLocal) > 1) continue;
    const sim = merchantSimilarity(c.merchant, r.merchant);
    if (sim !== null && sim < MERCHANT_MIN_JACCARD) continue;
    add(c, "similar");
  }
  return out;
}
