// Pure formatting for the dev ocr-check screen. Rows carry amount/date only: no merchant,
// no names, no raw OCR text, so the summary is safe to paste into the acceptance doc.
export type CheckRow = {
  /** 1-based photo number in the picked batch */
  n: number;
  /** e.g. "12.50 USD", null when no total was found */
  total: string | null;
  /** YYYY-MM-DD, null when no date was found */
  date: string | null;
  ms: number;
  rotation: number;
  /** number of receipts split detection found (1 = no split) */
  segments?: number;
  error?: boolean;
};

export function formatRow(r: CheckRow): string {
  if (r.error) return `#${r.n}: ERROR`;
  const split = r.segments && r.segments > 1 ? ` · split ${r.segments}` : "";
  return `#${r.n}: total ${r.total ?? "—"} · date ${r.date ?? "—"} · ${r.ms} ms · rot ${r.rotation}${split}`;
}

export function medianMs(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function summarize(rows: CheckRow[]): string {
  const ok = rows.filter((r) => !r.error);
  const times = ok.map((r) => r.ms);
  const max = times.length ? Math.max(...times) : 0;
  const errors = rows.length - ok.length;
  return (
    `photos ${rows.length} · totals found ${ok.filter((r) => r.total).length} · ` +
    `dates found ${ok.filter((r) => r.date).length} · median ${medianMs(times)} ms · max ${max} ms` +
    (errors ? ` · errors ${errors}` : "")
  );
}

/** Summary line + one row per photo: the only text the Copy button exposes. */
export function buildCopyText(rows: CheckRow[]): string {
  return [summarize(rows), ...rows.map(formatRow)].join("\n");
}
