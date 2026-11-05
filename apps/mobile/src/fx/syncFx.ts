import type { AppDb } from "@/db/types";
import type { PrefsStore } from "@/prefs/prefs";

import { ensureRates, type FxPass } from "./rates";
import { needsReconvert, receiptDatesNeedingRates, reconvertAll } from "./reconvert";

export interface SyncFxDeps {
  db: AppDb;
  prefs: Pick<PrefsStore, "get" | "set">;
  home: string;
  now: number;
  fetchFn?: typeof fetch;
  isCancelled?: () => boolean;
}

/**
 * One FX sync pass: refresh `latest` (at most one attempt), fetch rates for foreign receipt
 * dates, persist the cache, then re-convert receipts if tables changed or some receipt is not
 * yet converted to `home`. The first network failure ends all fetching for the pass. If the
 * cache is still quoted against another base (home changed while offline), receipts are left
 * as they are until a later pass succeeds.
 */
export async function syncFx({ db, prefs, home, now, fetchFn, isCancelled }: SyncFxDeps): Promise<void> {
  const pass: FxPass = {};
  const initial = prefs.get("fxTables");
  let cache = await ensureRates(initial, home, "latest", now, fetchFn, pass);
  for (const d of receiptDatesNeedingRates(db, home)) {
    if (isCancelled?.()) return;
    cache = await ensureRates(cache, home, d, now, fetchFn, pass);
  }
  if (isCancelled?.()) return;
  const changed = cache !== initial;
  if (changed) prefs.set("fxTables", cache);
  if (cache.base !== home.toLowerCase()) return;
  if (changed || needsReconvert(db, home)) reconvertAll(db, home, cache);
}
