// Pay-period ("payday month") date math. Dates are local "YYYY-MM-DD"; integer/string
// arithmetic only, no Date. A period starts on `startDay` (1 = calendar month) and ends the
// day before the next start. Label: start day 1-15 names the month the period starts in,
// 16+ names the month it ends in (so a 25th payday covers the following month).
import { addDays, daysInMonth, pad2, ymd } from "../dates/civil";

export type PayPeriod = { from: string; to: string; label: string };

function nextMonth(y: number, m: number): [number, number] {
  return m === 12 ? [y + 1, 1] : [y, m + 1];
}

function prevMonth(y: number, m: number): [number, number] {
  return m === 1 ? [y - 1, 12] : [y, m - 1];
}

/** The pay period containing `localDate`. `startDay` is clamped to 1..28. */
export function payPeriodOf(localDate: string, startDay: number): PayPeriod {
  const s = Math.min(28, Math.max(1, Math.trunc(startDay)));
  const y = Number(localDate.slice(0, 4));
  const m = Number(localDate.slice(5, 7));
  const d = Number(localDate.slice(8, 10));
  if (s === 1) {
    return { from: ymd(y, m, 1), to: ymd(y, m, daysInMonth(y, m)), label: `${y}-${pad2(m)}` };
  }
  const [fy, fm] = d >= s ? [y, m] : prevMonth(y, m);
  const [ty, tm] = nextMonth(fy, fm);
  const label = s <= 15 ? `${fy}-${pad2(fm)}` : `${ty}-${pad2(tm)}`;
  return { from: ymd(fy, fm, s), to: ymd(ty, tm, s - 1), label };
}

/** The period immediately before `p`. */
export function previousPayPeriod(p: PayPeriod, startDay: number): PayPeriod {
  return payPeriodOf(addDays(p.from, -1), startDay);
}

/** The `n` periods ending at the one containing `today`, oldest first. */
export function lastPayPeriods(today: string, n: number, startDay: number): PayPeriod[] {
  const out: PayPeriod[] = [];
  let p = payPeriodOf(today, startDay);
  for (let i = 0; i < n; i++) {
    out.unshift(p);
    p = previousPayPeriod(p, startDay);
  }
  return out;
}
