// Pay-period ("payday month") date math. Dates are local "YYYY-MM-DD"; integer/string
// arithmetic only, no Date. A period starts on `startDay` (1 = calendar month) and ends the
// day before the next start. Label: start day 1-15 names the month the period starts in,
// 16+ names the month it ends in (so a 25th payday covers the following month).
import { daysInMonth, pad2 } from "./stats";

export type PayPeriod = { from: string; to: string; label: string };

const ymd = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

function nextMonth(y: number, m: number): [number, number] {
  return m === 12 ? [y + 1, 1] : [y, m + 1];
}

function prevMonth(y: number, m: number): [number, number] {
  return m === 1 ? [y - 1, 12] : [y, m - 1];
}

/** Days since 1970-01-01 (proleptic Gregorian, integer civil algorithm). */
function toDayNumber(date: string): number {
  let y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  if (m <= 2) y -= 1;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function fromDayNumber(n: number): string {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return ymd(yoe + era * 400 + (m <= 2 ? 1 : 0), m, d);
}

const addDays = (date: string, n: number) => fromDayNumber(toDayNumber(date) + n);

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
