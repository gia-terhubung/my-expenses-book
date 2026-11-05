import type { OcrObservation } from "../../modules/receipt-ocr";

/**
 * Rebuilds text lines from OCR boxes (normalized, top-left origin, upright).
 * Rows run top to bottom; items in a row run left to right, joined by two spaces.
 * An item joins a row when its vertical center differs from the row's first item
 * by less than 0.5 × box height (mean of the two heights).
 */
export function toLines(obs: OcrObservation[]): string[] {
  const items = obs
    .map((o) => ({ text: o.text.trim(), x: o.box.x, cy: o.box.y + o.box.h / 2, h: o.box.h }))
    .filter((i) => i.text.length > 0)
    .sort((a, b) => a.cy - b.cy);

  const rows: (typeof items)[] = [];
  for (const item of items) {
    const row = rows[rows.length - 1];
    const anchor = row?.[0];
    if (anchor && Math.abs(item.cy - anchor.cy) < 0.5 * ((item.h + anchor.h) / 2)) {
      row.push(item);
    } else {
      rows.push([item]);
    }
  }

  return rows.map((row) =>
    row
      .sort((a, b) => a.x - b.x)
      .map((i) => i.text)
      .join("  "),
  );
}
