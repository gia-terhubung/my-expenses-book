import { useEffect } from "react";

import { useDb } from "@/db/DatabaseProvider";
import { usePref, usePrefs } from "@/prefs/PrefsProvider";

import { ensureRates } from "./rates";
import { needsReconvert, receiptDatesNeedingRates, reconvertAll } from "./reconvert";

/**
 * Keeps FX tables fresh and receipts converted to the home currency. Runs in an effect (never
 * blocks render) when the home currency changes, and once on mount only if some receipt is not
 * yet converted to it (so an unchanged home currency with converted receipts costs nothing).
 * Network errors are swallowed: offline leaves the cache and receipts untouched.
 */
export function useFx(): void {
  const db = useDb();
  const prefs = usePrefs();
  const home = usePref("homeCurrency");

  useEffect(() => {
    if (!home) return;
    let cancelled = false;
    void (async () => {
      try {
        const t = Date.now();
        const initial = prefs.get("fxTables");
        let cache = await ensureRates(initial, home, "latest", t);
        for (const d of receiptDatesNeedingRates(db, home)) {
          if (cancelled) return;
          cache = await ensureRates(cache, home, d, t);
        }
        if (cancelled) return;
        const changed = cache !== initial;
        if (changed) prefs.set("fxTables", cache);
        if (changed || needsReconvert(db, home)) reconvertAll(db, home, cache);
      } catch {
        // never surface FX failures
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, prefs, home]);
}
