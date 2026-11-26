import { Stack } from "expo-router";
import { useVerticalBarEdgeIOS } from "expo-status-bar";
import { useCallback, useState, type ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useAddReceiptContext } from "@/capture/AddReceiptProvider";

import { FloatingAddButton } from "./FloatingAddButton";
import {
  ContentInsetsContext,
  TabRootContext,
  useInNativeTabs,
  useNavSpike,
} from "./navSpike";
import { PlusClaimContext, usePlusMenu, useShortColumn } from "./PlusMenu";
import { useLayout } from "./useLayout";

/**
 * SPIKE: the + on an iOS native tab screen. Rendered inside each tab screen so it reads that
 * screen's safe area (NativeTabs gives each tab its own, which already includes the tab bar or the
 * Duo side column). Renders nothing off iOS native tabs.
 */
export function TabPlus({ home = false }: { home?: boolean }) {
  const inNativeTabs = useInNativeTabs();
  const { plus } = useNavSpike();
  // Variant D is added to every page of a tab stack by its layout (TabStackPlus), not here.
  const edge = useVerticalBarEdgeIOS();
  // B without a side column (plain iPhone, iPad) falls back to the floating +.
  // Home keeps the floating + near the thumb (owner, 2026-11-26), except in a short column, where the
  // + goes into the column (owner: no floating + held sideways); other pages put it in the column.
  const short = useShortColumn();
  const floating =
    plus === "C" || (plus === "B" && (edge === null || (home && !short)));
  if (!inNativeTabs || !floating) return null;
  return <FloatingAddButton />;
}

/** Home floats its +; Search (its bar is the search field) and sheets (left slot is Cancel) have none. */
const NO_HEADER_PLUS = new Set([
  "index",
  "search",
  "search-filter",
  "sheet",
  "photo",
  "recurring/[id]",
]);

/** SPIKE: variant D on every page of a tab stack (owner, 2026-11-26). Used as the stack's screenLayout. */
export function TabStackPlus({
  children,
  routeName,
}: {
  children: ReactNode;
  routeName: string;
}) {
  const inNativeTabs = useInNativeTabs();
  const { plus } = useNavSpike();
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
      {inNativeTabs && plus === "D" ? <ToolbarPlus /> : null}
      {/* Short column: Home has no ⋯, so its + goes into the column too (no floating +). */}
      {inNativeTabs &&
      plus === "B" &&
      edge !== null &&
      claims === 0 &&
      (!NO_HEADER_PLUS.has(routeName) || (short && routeName === "index")) ? (
        <HeaderPlus />
      ) : null}
    </PlusClaimContext.Provider>
  );
}

/** Variant B: the + menu on the right of the header, so in the Duo column it comes after Back. */
function HeaderPlus() {
  const menu = usePlusMenu();
  return <Stack.Toolbar placement="right">{menu}</Stack.Toolbar>;
}

function ToolbarPlus() {
  const { t } = useTranslation();
  const add = useAddReceiptContext();
  return (
    <Stack.Toolbar placement="bottom">
      <Stack.Toolbar.Spacer />
      <Stack.Toolbar.Button
        icon="plus"
        variant="prominent"
        accessibilityLabel={t("capture.add")}
        onPress={add.open}
      >
        {t("capture.add")}
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}

/**
 * SPIKE: a tab screen on iOS native tabs. Pads the content by the tab's own side insets (they
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
  if (bleed && !split) {
    return (
      <TabRootContext.Provider value>
        <ContentInsetsContext.Provider
          value={{ left: insets.left, right: insets.right }}
        >
          <View style={{ flex: 1 }}>
            {children}
            <TabPlus home={home} />
          </View>
        </ContentInsetsContext.Provider>
      </TabRootContext.Provider>
    );
  }
  return (
    <TabRootContext.Provider value>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          }}
        >
          {children}
        </View>
        <TabPlus home={home} />
      </View>
    </TabRootContext.Provider>
  );
}
