import { createContext, useContext, useSyncExternalStore } from "react";

/**
 * SPIKE (spike/duo-native-nav only): dev switches for the live review, so the owner can compare
 * without a restart. In memory; resets on reload. Not part of the plan of record.
 */
export type TabPlacement = "automatic" | "sidebar" | "tabBar";
export type PlusVariant = "C" | "D" | "E";
export type NavSpike = { placement: TabPlacement; plus: PlusVariant };

let state: NavSpike = { placement: "tabBar", plus: "E" };
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

/**
 * SPIKE: side insets a full-width tab screen leaves to its content (the iPhone Duo side column).
 * Backgrounds (the slip) bleed under the column; text and rows pad by these. 0 everywhere else.
 */
export type ContentInsets = { left: number; right: number };
export const ContentInsetsContext = createContext<ContentInsets>({ left: 0, right: 0 });
export const useContentInsets = () => useContext(ContentInsetsContext);

/** SPIKE: true on a tab's root screen (set by TabScreen); its in-page header is not a stack header. */
export const TabRootContext = createContext(false);
export const useInTabRoot = () => useContext(TabRootContext);
