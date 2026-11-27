import { createContext, useContext } from "react";

/** True inside the iOS NativeTabs navigator (set by `(tabs)/_layout.tsx`). */
export const NativeTabsContext = createContext(false);
export const useInNativeTabs = () => useContext(NativeTabsContext);

/**
 * Side insets a full-width tab screen leaves to its content (the iPhone Duo side column).
 * Backgrounds (the slip) bleed under the column; text and rows pad by these. 0 everywhere else.
 */
export type ContentInsets = { left: number; right: number };
export const ContentInsetsContext = createContext<ContentInsets>({ left: 0, right: 0 });
export const useContentInsets = () => useContext(ContentInsetsContext);

/** True on a tab's root screen (set by TabScreen); its in-page header is not a stack header. */
export const TabRootContext = createContext(false);
export const useInTabRoot = () => useContext(TabRootContext);
