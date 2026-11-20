// Civil-date helpers shared by stats, pay periods and recurring rules. Dates are local
// "YYYY-MM-DD" strings; integer arithmetic only, no Date. Leaf module: imports nothing.

export const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export const ymd = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** True for a real calendar day written as "YYYY-MM-DD" (leap years included). */
export function isValidYmd(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

/** Days since 1970-01-01 (proleptic Gregorian, integer civil algorithm). */
export function toDayNumber(date: string): number {
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

export function fromDayNumber(n: number): string {
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

export const addDays = (date: string, n: number) => fromDayNumber(toDayNumber(date) + n);
