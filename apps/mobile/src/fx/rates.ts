import type { FxCache } from "@/prefs/prefs";

export type { FxCache };

const STALE_MS = 7 * 86_400_000;
const MAX_DATES = 120;

export function rateUrl(base: string, date: string | "latest"): string {
  return `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${base.toLowerCase()}.json`;
}

/** Fetches one rate table. Only the currency code and date leave the device. Throws on any failure. */
export async function fetchRates(
  base: string,
  date: string | "latest",
  fetchFn: typeof fetch = fetch,
): Promise<{ date: string; rates: Record<string, string> }> {
  const res = await fetchFn(rateUrl(base, date));
  if (!res.ok) throw new Error(`FX fetch failed: ${res.status}`);
  const body = (await res.json()) as Record<string, unknown>;
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

function prune(byDate: FxCache["byDate"]): FxCache["byDate"] {
  const keys = Object.keys(byDate).sort();
  if (keys.length <= MAX_DATES) return byDate;
  const out: FxCache["byDate"] = {};
  for (const k of keys.slice(keys.length - MAX_DATES)) out[k] = byDate[k];
  return out;
}

/**
 * Makes sure `latest` is fresh (< 7 days) and `date` is cached, fetching as needed. Network
 * errors are swallowed (offline is normal): a failed step leaves the cache as it was. A base
 * change starts a new table. Returns the same object when nothing changed.
 */
export async function ensureRates(
  cache: FxCache,
  base: string,
  date: string | "latest",
  now: number,
  fetchFn: typeof fetch = fetch,
): Promise<FxCache> {
  const b = base.toLowerCase();
  let work: FxCache = cache.base === b ? cache : { base: b, latestDate: null, fetchedAt: null, byDate: {} };
  let changed = false;

  const stale = work.fetchedAt === null || now - work.fetchedAt > STALE_MS;
  if (stale) {
    try {
      const r = await fetchRates(b, "latest", fetchFn);
      work = { ...work, latestDate: r.date, fetchedAt: now, byDate: { ...work.byDate, [r.date]: r.rates } };
      changed = true;
    } catch {
      /* offline */
    }
  }
  if (date !== "latest" && !work.byDate[date]) {
    try {
      const r = await fetchRates(b, date, fetchFn);
      work = { ...work, byDate: { ...work.byDate, [date]: r.rates } };
      changed = true;
    } catch {
      /* offline, or date not published */
    }
  }
  if (!changed) return cache;
  return { ...work, byDate: prune(work.byDate) };
}
