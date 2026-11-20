import { devTimeZone } from "@/dates/clock";

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** Wall-clock fields of `ms` in `tz`; null when the zone is unknown to Intl. */
function partsIn(ms: number, tz: string): number[] | null {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return null;
  }
  const parts = fmt.formatToParts(ms);
  const v = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return [v("year"), v("month"), v("day"), v("hour") % 24, v("minute"), v("second")];
}

/** Device IANA zone (falls back to "UTC"); the dev clock's zone when one is set (dev builds only). */
export function deviceTimeZone(): string {
  const dev = devTimeZone();
  if (dev) return dev;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** `YYYY-MM-DDTHH:MM:SS` wall time of `date` in `tz` (UTC when the zone is unknown). */
export function formatLocal(date: Date, tz: string): string {
  const p = partsIn(date.getTime(), tz) ?? [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  ];
  return `${pad(p[0], 4)}-${pad(p[1])}-${pad(p[2])}T${pad(p[3])}:${pad(p[4])}:${pad(p[5])}`;
}

/** UTC ms of a `YYYY-MM-DDTHH:MM[:SS]` wall time in `tz` (treated as UTC when the zone is unknown). */
export function localToUtc(local: string, tz: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(local);
  if (!m) throw new Error(`Invalid local time: ${local}`);
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  const offsetAt = (ms: number) => {
    const p = partsIn(ms, tz);
    return p ? Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4], p[5]) - ms : 0;
  };
  // Two passes settle the offset across DST boundaries.
  const first = wall - offsetAt(wall);
  return wall - offsetAt(first);
}
