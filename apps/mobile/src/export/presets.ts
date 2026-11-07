import { taxYearOf, taxYearRange } from "../taxYear/taxYear";

export type RangePreset = "thisTaxYear" | "lastTaxYear" | "thisMonth" | "lastMonth" | "all" | "custom";

const pad2 = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

function monthRange(y: number, m: number): { from: string; to: string } {
  return { from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-${pad2(lastDay(y, m))}` };
}

/** Inclusive local-date range for a preset; `all` and `custom` are open-ended. */
export function presetRange(p: RangePreset, today: string, taxStartMonth: number): { from?: string; to?: string } {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  switch (p) {
    case "thisTaxYear":
      return taxYearRange(taxYearOf(today, taxStartMonth), taxStartMonth);
    case "lastTaxYear":
      return taxYearRange(taxYearOf(today, taxStartMonth) - 1, taxStartMonth);
    case "thisMonth":
      return monthRange(y, m);
    case "lastMonth":
      return m === 1 ? monthRange(y - 1, 12) : monthRange(y, m - 1);
    default:
      return {};
  }
}
