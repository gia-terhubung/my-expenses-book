import { extractTotalValue } from "./index";

const HEADER_CANDIDATES = 3;

/** Comparison key for a header line: uppercase letters and digits only. */
function key(line: string): string {
  return line.toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");
}

const isNoise = (line: string) => (line.match(/\p{L}/gu)?.length ?? 0) < 3;

/**
 * Splits one OCR page holding several receipts (e.g. two shipping labels in one photo).
 * A header line (one of the first 3 non-noise lines) that recurs later starts a new
 * segment, but only when the segments have different totals: an EDC slip photographed
 * with its POS receipt repeats the header with the same total and stays one receipt.
 */
export function splitReceipts(lines: string[]): {
  segments: string[][];
  reason: "single" | "repeated-header";
} {
  const headers = lines
    .map((text, index) => ({ text, index }))
    .filter((l) => l.text.trim() && !isNoise(l.text))
    .slice(0, HEADER_CANDIDATES);

  for (const header of headers) {
    const k = key(header.text);
    const starts = lines
      .map((l, i) => (i > header.index && key(l) === k ? i : -1))
      .filter((i) => i >= 0);
    if (!starts.length) continue;
    const bounds = [0, ...starts, lines.length];
    const segments = bounds.slice(0, -1).map((b, i) => lines.slice(b, bounds[i + 1]));
    const totals = segments.map((s) => extractTotalValue(s));
    if (totals.every((t) => t !== null) && new Set(totals).size > 1) {
      return { segments, reason: "repeated-header" };
    }
  }
  return { segments: [lines], reason: "single" };
}
