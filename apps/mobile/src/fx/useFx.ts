import { useEffect } from "react";

import { useDb } from "@/db/DatabaseProvider";
import { usePref, usePrefs } from "@/prefs/PrefsProvider";

import { syncFx } from "./syncFx";

/**
 * Keeps FX tables fresh and receipts converted to the home currency. Runs in an effect (never
 * blocks render) on mount and when the home currency changes; see syncFx for what a pass does.
 * Failures are swallowed: offline leaves the cache and receipts untouched.
 */
export function useFx(): void {
  const db = useDb();
  const prefs = usePrefs();
  const home = usePref("homeCurrency");

  useEffect(() => {
    if (!home) return;
    let cancelled = false;
    syncFx({ db, prefs, home, now: Date.now(), isCancelled: () => cancelled }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [db, prefs, home]);
}
