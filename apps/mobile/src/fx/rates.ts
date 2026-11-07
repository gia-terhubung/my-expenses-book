import type { FxCache } from "@/prefs/prefs";

export type { FxCache };

const STALE_MS = 7 * 86_400_000;
const MAX_DATES = 120;
const FETCH_TIMEOUT_MS = 10_000;

/** HTTP answer other than 2xx (the server is reachable, the resource is not). */
export class FxHttpError extends Error {
  constructor(readonly status: number) {
    super(`FX fetch failed: ${status}`);
    this.name = "FxHttpError";
  }
}

/**
 * Per-sync-pass state: `latest` is tried at most once and a network failure stops the pass.
 * `fetched` collects the dates added this pass; pruning never drops them, so the reconvert at the
 * end of the pass can use every rate the pass paid for.
 */
export interface FxPass {
  offline?: boolean;
  latestTried?: boolean;
  fetched?: Set<string>;
}

/**
 * True when `date` needs no fetch for `base`: its table is cached, or the API answered 404 for it
 * less than 7 days ago (ensureRates would not ask again).
 */
export function isDateKnown(cache: FxCache, base: string, date: string, now: number): boolean {
  if (cache.base !== base.toLowerCase()) return false;
  if (cache.byDate[date]) return true;
  const missedAt = cache.missingDates?.[date];
  return missedAt !== undefined && now - missedAt <= STALE_MS;
}

export function rateUrl(base: string, date: string | "latest"): string {
  return `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${base.toLowerCase()}.json`;
}

/** Fetches one rate table. Only the currency code and date leave the device. Throws on any failure. */
export async function fetchRates(
  base: string,
  date: string | "latest",
  fetchFn: typeof fetch = fetch,
): Promise<{ date: string; rates: Record<string, string> }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let body: Record<string, unknown>;
  try {
    const res = await fetchFn(rateUrl(base, date), { signal: ctrl.signal });
    if (!res.ok) throw new FxHttpError(res.status);
    body = (await res.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
  const table = body[base.toLowerCase()];
  if (typeof body.date !== "string" || typeof table !== "object" || table === null) {
    throw new Error("FX response malformed");
  }
  const rates: Record<string, string> = {};
  for (const [code, n] of Object.entries(table)) {
    if (typeof n === "number" && Number.isFinite(n) && n > 0) rates[code.toLowerCase()] = String(n);
  }
  return { date: body.date, rates };
}

/** Keeps the newest MAX_DATES tables, plus every `keep` date (fetched in the current pass). */
function prune(byDate: FxCache["byDate"], keep: ReadonlySet<string> = new Set()): FxCache["byDate"] {
  const keys = Object.keys(byDate).sort();
  if (keys.length <= MAX_DATES) return byDate;
  const out: FxCache["byDate"] = {};
  for (const k of keys.slice(keys.length - MAX_DATES)) out[k] = byDate[k];
  for (const k of keep) if (byDate[k]) out[k] = byDate[k];
  return out;
}

/**
 * Makes sure `latest` is fresh (< 7 days) and `date` is cached, fetching as needed. Network
 * errors are swallowed (offline is normal). With a shared `pass`, `latest` is attempted once
 * and the first network failure stops all further fetches in that pass. Dates answered 404
 * are remembered for 7 days. A base change starts a new table. Returns the same object when
 * nothing changed.
 */
export async function ensureRates(
  cache: FxCache,
  base: string,
  date: string | "latest",
  now: number,
  fetchFn: typeof fetch = fetch,
  pass: FxPass = {},
): Promise<FxCache> {
  const b = base.toLowerCase();
  let work: FxCache = cache.base === b ? cache : { base: b, latestDate: null, fetchedAt: null, byDate: {} };
  let changed = false;

  const stale = work.fetchedAt === null || now - work.fetchedAt > STALE_MS;
  if (stale && !pass.latestTried && !pass.offline) {
    pass.latestTried = true;
    try {
      const r = await fetchRates(b, "latest", fetchFn);
      work = { ...work, latestDate: r.date, fetchedAt: now, byDate: { ...work.byDate, [r.date]: r.rates } };
      changed = true;
    } catch (e) {
      if (!(e instanceof FxHttpError)) pass.offline = true;
    }
  }
  if (date !== "latest" && !work.byDate[date] && !pass.offline) {
    const missedAt = work.missingDates?.[date];
    if (missedAt === undefined || now - missedAt > STALE_MS) {
      try {
        const r = await fetchRates(b, date, fetchFn);
        work = { ...work, byDate: { ...work.byDate, [date]: r.rates } };
        (pass.fetched ??= new Set()).add(date);
        changed = true;
      } catch (e) {
        if (e instanceof FxHttpError && e.status === 404) {
          work = { ...work, missingDates: { ...work.missingDates, [date]: now } };
          changed = true;
        } else {
          pass.offline = true;
        }
      }
    }
  }
  if (!changed) return cache;
  return { ...work, byDate: prune(work.byDate, pass.fetched) };
}
