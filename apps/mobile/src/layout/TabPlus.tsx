import { Stack } from "expo-router";
import { useVerticalBarEdgeIOS } from "expo-status-bar";
import { useCallback, useState, type ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FloatingAddButton } from "./FloatingAddButton";
import {
  ContentInsetsContext,
  TabRootContext,
  useInNativeTabs,
} from "./navContext";
import { PlusClaimContext, usePlusMenu, useShortColumn } from "./PlusMenu";
import { useLayout } from "./useLayout";

/**
 * The + on an iOS native tab screen. Rendered inside each tab screen so it reads that
 * screen's safe area (NativeTabs gives each tab its own, which already includes the tab bar or the
 * Duo side column). Renders nothing off iOS native tabs.
 */
export function TabPlus({ home = false }: { home?: boolean }) {
  const inNativeTabs = useInNativeTabs();
  const edge = useVerticalBarEdgeIOS();
  // Without a side column (plain iPhone, iPad) the + floats.
  // Home keeps the floating + near the thumb (owner, 2026-11-26), except in a short column, where the
  // + goes into the column (owner: no floating + held sideways); other pages put it in the column.
  const short = useShortColumn();
  const floating = edge === null || (home && !short);
  if (!inNativeTabs || !floating) return null;
  return <FloatingAddButton />;
}

const NO_INSETS = { left: 0, right: 0 };

/** Home floats its +; Search (its bar is the search field) and sheets (left slot is Cancel) have none. */
const NO_HEADER_PLUS = new Set([
  "index",
  "search",
  "search-filter",
  "sheet",
  "photo",
  "recurring/[id]",
]);

/** The column + on every page of a tab stack. Used as the stack's screenLayout. */
export function TabStackPlus({
  children,
  routeName,
}: {
  children: ReactNode;
  routeName: string;
}) {
  const inNativeTabs = useInNativeTabs();
  const edge = useVerticalBarEdgeIOS();
  const short = useShortColumn();
  // A page with its own right-side buttons puts the + last among them (PlusToolbarMenu) and claims it.
  const [claims, setClaims] = useState(0);
  const claim = useCallback(() => {
    setClaims((n) => n + 1);
    return () => setClaims((n) => n - 1);
  }, []);
  return (
    <PlusClaimContext.Provider value={claim}>
      {children}
      {/* Short column: Home has no ⋯, so its + goes into the column too (no floating +). */}
      {inNativeTabs &&
      edge !== null &&
      claims === 0 &&
      (!NO_HEADER_PLUS.has(routeName) || (short && routeName === "index")) ? (
        <HeaderPlus />
      ) : null}
    </PlusClaimContext.Provider>
  );
}

/** The + menu on the right of the header, so in the Duo column it comes after Back. */
function HeaderPlus() {
  const menu = usePlusMenu();
  return <Stack.Toolbar placement="right">{menu}</Stack.Toolbar>;
}

/**
 * A tab screen on iOS native tabs. Pads the content by the tab's own side insets (they
 * include the iPhone Duo side column), then adds the +. Off native tabs it is a plain pass-through.
 */
export function TabScreen({
  children,
  home = false,
  bleed = false,
}: {
  children: ReactNode;
  /** Receipts (Home): the + floats at the bottom instead of sitting in the side column. */
  home?: boolean;
  /** Full width: backgrounds run under the side column, content pads via ContentInsetsContext. Single pane only. */
  bleed?: boolean;
}) {
  const inNativeTabs = useInNativeTabs();
  const insets = useSafeAreaInsets();
  const { split } = useLayout();
  if (!inNativeTabs)
    return <TabRootContext.Provider value>{children}</TabRootContext.Provider>;
  // The same element tree in both cases: a fold or rotation changes `split`, and a different tree
  // would remount the whole tab (closing its sheets and losing what was typed in them).
  const full = bleed && !split;
  return (
    <TabRootContext.Provider value>
      <ContentInsetsContext.Provider
        value={full ? { left: insets.left, right: insets.right } : NO_INSETS}
      >
        <View style={{ flex: 1 }}>
          <View
            style={{
              flex: 1,
              paddingLeft: full ? 0 : insets.left,
              paddingRight: full ? 0 : insets.right,
            }}
          >
            {children}
          </View>
          <TabPlus home={home} />
        </View>
      </ContentInsetsContext.Provider>
    </TabRootContext.Provider>
  );
}
