const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** Local calendar day of `d` as YYYY-MM-DD. */
export function dateToLocalString(d: Date): string {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM-DD to a Date at noon local time, so DST shifts never change the day. Invalid input gives today. */
export function localStringToDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  const now = new Date();
  const [y, mo, d] = m ? [Number(m[1]), Number(m[2]) - 1, Number(m[3])] : [now.getFullYear(), now.getMonth(), now.getDate()];
  return new Date(y, mo, d, 12, 0, 0, 0);
}

/** Android's Material picker reports/accepts UTC midnight of the chosen day. */
export function utcDateToString(d: Date): string {
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function stringToUtcDate(s: string): Date {
  const local = localStringToDate(s);
  return new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
}

/**
 * A YYYY-MM-DD day read in full for screen readers ("7 November 2026"; English day-first like the
 * rest of the app). Formatted in UTC so the device zone never shifts the day. Other text is
 * returned as typed.
 */
export function spokenDate(s: string, locale: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, { dateStyle: "long", timeZone: "UTC" }).format(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
  );
}
