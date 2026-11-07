import type { ReceiptFilter } from "@/db/repositories/receiptQueries";
import { taxYearOf, taxYearRange } from "@/taxYear/taxYear";

export type DatePreset = "all" | "thisMonth" | "lastMonth" | "thisTaxYear" | "lastTaxYear" | "custom";

export type SearchState = {
  text: string;
  preset: DatePreset;
  /** Custom range bounds, local YYYY-MM-DD or "" when unset. */
  from: string;
  to: string;
  categoryIds: string[];
  /** undefined = any folder, null = no folder. */
  folderId: string | null | undefined;
  currency: string | undefined;
};

export const EMPTY_SEARCH: SearchState = {
  text: "",
  preset: "all",
  from: "",
  to: "",
  categoryIds: [],
  folderId: undefined,
  currency: undefined,
};

const pad2 = (n: number) => String(n).padStart(2, "0");

function monthRange(year: number, month: number): { from: string; to: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad2(month)}-01`, to: `${year}-${pad2(month)}-${pad2(last)}` };
}

function dateBounds(
  s: SearchState,
  today: string,
  taxStartMonth: number,
): { from?: string; to?: string } {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  switch (s.preset) {
    case "thisMonth":
      return monthRange(year, month);
    case "lastMonth":
      return month === 1 ? monthRange(year - 1, 12) : monthRange(year, month - 1);
    case "thisTaxYear":
      return taxYearRange(taxYearOf(today, taxStartMonth), taxStartMonth);
    case "lastTaxYear":
      return taxYearRange(taxYearOf(today, taxStartMonth) - 1, taxStartMonth);
    case "custom":
      return { ...(s.from ? { from: s.from } : {}), ...(s.to ? { to: s.to } : {}) };
    default:
      return {};
  }
}

/** Query filter for `s`; `today` is the local YYYY-MM-DD. Blank text applies no text filter. */
export function toFilter(s: SearchState, today: string, taxStartMonth: number): ReceiptFilter {
  const f: ReceiptFilter = { ...dateBounds(s, today, taxStartMonth) };
  if (s.text.trim()) f.text = s.text;
  if (s.categoryIds.length > 0) f.categoryIds = s.categoryIds;
  if (s.folderId !== undefined) f.folderId = s.folderId;
  if (s.currency) f.currency = s.currency;
  return f;
}

/** Number of active filters; the text query is not counted. */
export function activeFilterCount(s: SearchState): number {
  return (
    (s.preset !== "all" ? 1 : 0) +
    (s.categoryIds.length > 0 ? 1 : 0) +
    (s.folderId !== undefined ? 1 : 0) +
    (s.currency ? 1 : 0)
  );
}
