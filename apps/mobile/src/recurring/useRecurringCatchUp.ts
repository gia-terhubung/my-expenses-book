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
import { todayIn } from "./occurrences";

// Module-level so the run in the root layout and the Home banner share one result, and so two
// mounted hooks never start a run at the same time.
let running = false;
let last: CatchUpResult | null = null;
// `last` is only valid for the DB it was created in and for the device-local day it was created
// on: Undo must never reach rows a restore brought back, nor rows from a weeks-old run.
let lastDb: AppDb | null = null;
let lastDay: string | null = null;
// Last device zone seen on foreground; a change re-plans notifications (09:00 is device-local).
let lastTz = deviceTimeZone();
// The newest mounted hook's run, so screens without the hook can ask for a run (a rule saved).
let latestAttempt: (() => void) | null = null;
// Reschedules run one after another so a cancel never lands between another run's schedules.
let scheduling: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();

function setLast(next: CatchUpResult | null): void {
  last = next;
  for (const cb of [...listeners]) cb();
}

/** Runs catch-up now through the mounted hook (same guards as a foreground run); no-op without one. */
export function requestCatchUp(): void {
  latestAttempt?.();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

/**
 * Re-plans the due-day notifications for draft-type rules, queued behind any reschedule already
 * running. Never throws. Call after every rule write.
 */
export function rescheduleRecurring(db: AppDb): void {
  scheduling = scheduling
    .then(() => rescheduleAll(db, deviceScheduler, now()))
    .catch((e) => logError("recurring", e));
}

/**
 * Creates due recurring expenses: on mount, on unlock and on AppState -> active, only while the
 * app is not obscured (locked or covered). Skips while a restore holds `restoreLease` and runs
 * when it frees. `last` collects what runs created until `dismiss()` (the Home banner + Undo); a
 * finished restore, a new DB handle or a new device-local day drops it.
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

  // Declared before the first run: a new handle (restore, reset) drops the old DB's result.
  useEffect(() => {
    if (lastDb !== db && last) setLast(null);
    lastDb = db;
  }, [db]);

  const attempt = useCallback(() => {
    if (obscuredRef.current || !home || running || restoreLease.held()) return;
    running = true;
    try {
      const at = now();
      const today = todayIn(deviceTimeZone(), at);
      if (last && lastDay !== today) setLast(null);
      const res = runCatchUp(db, { now: at, home, fx: prefs.get("fxTables") });
      if (res.createdIds.length > 0) {
        lastDay = today;
        setLast(
          last
            ? { createdIds: [...last.createdIds, ...res.createdIds], draftCount: last.draftCount + res.draftCount }
            : res,
        );
      }
      rescheduleRecurring(db);
    } catch (e) {
      logError("recurring", e);
    } finally {
      running = false;
    }
  }, [db, prefs, home]);

  useEffect(() => {
    latestAttempt = attempt;
    return () => {
      if (latestAttempt === attempt) latestAttempt = null;
    };
  }, [attempt]);

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
        rescheduleRecurring(db);
      }
      attempt();
    });
    return () => sub.remove();
  }, [attempt, db]);

  // A restore may have replaced the rows `last` points at (same ids, version 1): drop it first.
  useEffect(
    () =>
      restoreLease.onFree(() => {
        if (last) setLast(null);
        attempt();
      }),
    [attempt],
  );

  const { last: current, dismiss } = useCatchUpResult();
  return { last: current, dismiss, runNow: attempt };
}

/** What catch-up runs added since the last dismiss, without starting runs (the Home banner). */
export function useCatchUpResult(): { last: CatchUpResult | null; dismiss(): void } {
  const current = useSyncExternalStore(subscribe, () => last);
  const dismiss = useCallback(() => setLast(null), []);
  return { last: current, dismiss };
}
