import { createContext, useContext, useSyncExternalStore } from "react";

/**
 * SPIKE (spike/duo-native-nav only): dev switches for the live review, so the owner can compare
 * without a restart. In memory; resets on reload. Not part of the plan of record.
 */
export type TabPlacement = "automatic" | "sidebar" | "tabBar";
export type PlusVariant = "C" | "D";
export type NavSpike = { placement: TabPlacement; plus: PlusVariant };

let state: NavSpike = { placement: "tabBar", plus: "C" };
const listeners = new Set<() => void>();

export function setNavSpike(patch: Partial<NavSpike>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function useNavSpike(): NavSpike {
  return useSyncExternalStore(
    (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    () => state,
  );
}

/** True inside the iOS NativeTabs navigator (set by `(tabs)/_layout.tsx`). */
export const NativeTabsContext = createContext(false);
export const useInNativeTabs = () => useContext(NativeTabsContext);
