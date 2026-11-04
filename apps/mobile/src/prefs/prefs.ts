import { useCallback, useSyncExternalStore } from "react";

export type Language = "en" | "id" | "es" | "pt-BR";
/** Seconds of background time before re-lock; 0 = lock immediately. */
export type LockTimeout = 0 | 60 | 300 | 900;
export type OnboardingStep = "language" | "currency" | "lock" | "done";

export interface Prefs {
  homeCurrency: string | null;
  language: Language | null;
  lockEnabled: boolean;
  lockTimeout: LockTimeout;
  onboardingStep: OnboardingStep;
  lastBackupAt: number | null;
  receiptsSinceBackup: number;
  /** 1-12 */
  taxYearStartMonth: number;
}

/** Minimal storage surface; tests use a Map, the app wraps encrypted MMKV. */
export interface KV {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}

export const PREF_DEFAULTS: Prefs = {
  homeCurrency: null,
  language: null,
  lockEnabled: false,
  lockTimeout: 60,
  onboardingStep: "language",
  lastBackupAt: null,
  receiptsSinceBackup: 0,
  taxYearStartMonth: 1,
};

export interface PrefsStore {
  get<K extends keyof Prefs>(k: K): Prefs[K];
  set<K extends keyof Prefs>(k: K, v: Prefs[K]): void;
  subscribe<K extends keyof Prefs>(k: K, cb: () => void): () => void;
  /** Deletes every pref (back to defaults) and notifies subscribers. */
  reset(): void;
}

const KEYS = Object.keys(PREF_DEFAULTS) as (keyof Prefs)[];

export function createPrefs(storage: KV): PrefsStore {
  const listeners = new Map<keyof Prefs, Set<() => void>>();
  const notify = (k: keyof Prefs) => listeners.get(k)?.forEach((cb) => cb());

  return {
    get(k) {
      const raw = storage.getString(k);
      if (raw === undefined) return PREF_DEFAULTS[k];
      try {
        return JSON.parse(raw) as Prefs[typeof k];
      } catch {
        return PREF_DEFAULTS[k];
      }
    },
    set(k, v) {
      if (v === null) storage.delete(k);
      else storage.set(k, JSON.stringify(v));
      notify(k);
    },
    subscribe(k, cb) {
      let set = listeners.get(k);
      if (!set) listeners.set(k, (set = new Set()));
      set.add(cb);
      return () => void set.delete(cb);
    },
    reset() {
      for (const k of KEYS) {
        storage.delete(k);
        notify(k);
      }
    },
  };
}

/** Reads one pref reactively from a PrefsStore (see PrefsProvider). */
export function usePrefFrom<K extends keyof Prefs>(store: PrefsStore, k: K): Prefs[K] {
  const subscribe = useCallback((cb: () => void) => store.subscribe(k, cb), [store, k]);
  // Primitive values only, so snapshots are referentially stable.
  return useSyncExternalStore(subscribe, () => store.get(k));
}
