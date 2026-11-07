// Pure tax-year math. Dates are "YYYY-MM-DD" (local) and months are "YYYY-MM"; all
// arithmetic is on integers and strings, so no Date/timezone conversion is involved.

function parseYear(date: string): number {
  return Number(date.slice(0, 4));
}

function parseMonth(date: string): number {
  return Number(date.slice(5, 7));
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Year in which the tax year containing `localDate` starts. */
export function taxYearOf(localDate: string, startMonth: number): number {
  const year = parseYear(localDate);
  return parseMonth(localDate) >= startMonth ? year : year - 1;
}

/** Inclusive first and last day of the tax year that starts in `year`. */
export function taxYearRange(year: number, startMonth: number): { from: string; to: string } {
  const from = `${year}-${pad2(startMonth)}-01`;
  const endYear = startMonth === 1 ? year : year + 1;
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const to = `${endYear}-${pad2(endMonth)}-${pad2(daysInMonth(endYear, endMonth))}`;
  return { from, to };
}

/** "2026" for a January start, otherwise "2026/27". */
export function taxYearLabel(year: number, startMonth: number): string {
  if (startMonth === 1) return `${year}`;
  return `${year}/${pad2((year + 1) % 100)}`;
}

/** Distinct tax years covered by `months` ("YYYY-MM"), newest first. */
export function taxYearsFromMonths(months: string[], startMonth: number): number[] {
  const years = new Set<number>();
  for (const month of months) {
    years.add(taxYearOf(`${month}-01`, startMonth));
  }
  return [...years].sort((a, b) => b - a);
}
