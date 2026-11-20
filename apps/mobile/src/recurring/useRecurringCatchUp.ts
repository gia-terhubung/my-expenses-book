import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { restoreLease } from "@/backup/restoreLease";
import { now } from "@/dates/clock";
import { useDb } from "@/db/DatabaseProvider";
import { logError } from "@/errorLog/instance";
import { useAppObscured } from "@/lock/appObscured";
import { usePref, usePrefs } from "@/prefs/PrefsProvider";

import { runCatchUp, type CatchUpResult } from "./catchUp";

// Module-level so the run in the root layout and the Home banner share one result, and so two
// mounted hooks never start a run at the same time.
let running = false;
let last: CatchUpResult | null = null;
const listeners = new Set<() => void>();

function setLast(next: CatchUpResult | null): void {
  last = next;
  for (const cb of [...listeners]) cb();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

/**
 * Creates due recurring expenses: on mount, on unlock and on AppState -> active, only while the
 * app is not obscured (locked or covered). Skips while a restore holds `restoreLease` and runs
 * when it frees. `last` collects what runs created until `dismiss()` (the Home banner + Undo).
 */
export function useRecurringCatchUp(): { last: CatchUpResult | null; dismiss(): void } {
  const db = useDb();
  const prefs = usePrefs();
  const home = usePref("homeCurrency");
  const obscured = useAppObscured();
  const obscuredRef = useRef(obscured);
  useEffect(() => {
    obscuredRef.current = obscured;
  }, [obscured]);

  const attempt = useCallback(() => {
    if (obscuredRef.current || !home || running || restoreLease.held()) return;
    running = true;
    try {
      const res = runCatchUp(db, { now: now(), home, fx: prefs.get("fxTables") });
      if (res.createdIds.length > 0) {
        setLast(
          last
            ? { createdIds: [...last.createdIds, ...res.createdIds], draftCount: last.draftCount + res.draftCount }
            : res,
        );
      }
    } catch (e) {
      logError("recurring", e);
    } finally {
      running = false;
    }
  }, [db, prefs, home]);

  // Mount, unlock (obscured -> false) and home currency set.
  useEffect(() => {
    if (!obscured) attempt();
  }, [obscured, attempt]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") attempt();
    });
    return () => sub.remove();
  }, [attempt]);

  useEffect(() => restoreLease.onFree(attempt), [attempt]);

  const current = useSyncExternalStore(subscribe, () => last);
  const dismiss = useCallback(() => setLast(null), []);
  return { last: current, dismiss };
}
