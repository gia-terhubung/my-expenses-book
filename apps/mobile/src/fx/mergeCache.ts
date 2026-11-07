import type { FxCache } from "@/prefs/prefs";

import { prune } from "./rates";

const newer = <T extends string | number>(a: T | null, b: T | null): T | null => (a === null ? b : b === null ? a : a > b ? a : b);

/**
 * Merges a writer's `update` into the `current` stored cache (read fresh at write time), so a
 * slow writer cannot drop dates a concurrent writer added. Per date and code the update wins;
 * `missingDates` are unioned; `latestDate`/`fetchedAt` take the newer. A different base returns
 * `update` (home change resets the cache). Merge first, then prune: the update's own dates are
 * always kept, older current-only dates beyond the cap are dropped, so a deliberate prune in the
 * update is not undone.
 */
export function mergeFxCache(current: FxCache, update: FxCache): FxCache {
  if (current.base !== update.base) return update;
  const byDate: FxCache["byDate"] = { ...current.byDate };
  for (const [d, table] of Object.entries(update.byDate)) byDate[d] = { ...byDate[d], ...table };
  const merged: FxCache = {
    base: update.base,
    latestDate: newer(current.latestDate, update.latestDate),
    fetchedAt: newer(current.fetchedAt, update.fetchedAt),
    byDate: prune(byDate, new Set(Object.keys(update.byDate))),
  };
  if (current.missingDates || update.missingDates) {
    merged.missingDates = { ...current.missingDates, ...update.missingDates };
  }
  return merged;
}
