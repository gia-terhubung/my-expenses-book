import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { AppState } from "react-native";

import { restoreLease } from "@/backup/restoreLease";
import { now } from "@/dates/clock";
import { useDb } from "@/db/DatabaseProvider";
import type { AppDb } from "@/db/types";
import { deviceTimeZone } from "@/capture/localTime";
import { logError } from "@/errorLog/instance";
import { useAppObscured } from "@/lock/appObscured";
import { usePref, usePrefs } from "@/prefs/PrefsProvider";

import { runCatchUp, type CatchUpResult } from "./catchUp";
import { deviceScheduler } from "./deviceScheduler";
import { rescheduleAll } from "./notify";

// Module-level so the run in the root layout and the Home banner share one result, and so two
// mounted hooks never start a run at the same time.
let running = false;
let last: CatchUpResult | null = null;
// Last device zone seen on foreground; a change re-plans notifications (09:00 is device-local).
let lastTz = deviceTimeZone();
// Reschedules run one after another so a cancel never lands between another run's schedules.
let scheduling: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();

function setLast(next: CatchUpResult | null): void {
  last = next;
  for (const cb of [...listeners]) cb();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

/** Re-plans the due-day notifications for draft-type rules. Never throws. */
function reschedule(db: AppDb): void {
  scheduling = scheduling
    .then(() => rescheduleAll(db, deviceScheduler, now()))
    .catch((e) => logError("recurring", e));
}

/**
 * Creates due recurring expenses: on mount, on unlock and on AppState -> active, only while the
 * app is not obscured (locked or covered). Skips while a restore holds `restoreLease` and runs
 * when it frees. `last` collects what runs created until `dismiss()` (the Home banner + Undo).
 */
export function useRecurringCatchUp(): { last: CatchUpResult | null; dismiss(): void; runNow(): void } {
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
      reschedule(db);
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
      if (state !== "active") return;
      const tz = deviceTimeZone();
      if (tz !== lastTz) {
        lastTz = tz;
        reschedule(db);
      }
      attempt();
    });
    return () => sub.remove();
  }, [attempt, db]);

  useEffect(() => restoreLease.onFree(attempt), [attempt]);

  const current = useSyncExternalStore(subscribe, () => last);
  const dismiss = useCallback(() => setLast(null), []);
  return { last: current, dismiss, runNow: attempt };
}
