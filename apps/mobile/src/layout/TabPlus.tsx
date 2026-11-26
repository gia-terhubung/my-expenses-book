import { Stack } from "expo-router";
import { useVerticalBarEdgeIOS } from "expo-status-bar";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useAddReceiptContext } from "@/capture/AddReceiptProvider";

import { FloatingAddButton } from "./FloatingAddButton";
import { ContentInsetsContext, TabRootContext, useInNativeTabs, useNavSpike } from "./navSpike";
import { useLayout } from "./useLayout";

/**
 * SPIKE: the + on an iOS native tab screen. Rendered inside each tab screen so it reads that
 * screen's safe area (NativeTabs gives each tab its own, which already includes the tab bar or the
 * Duo side column). Renders nothing off iOS native tabs.
 */
export function TabPlus(_: { toolbar?: boolean }) {
  const inNativeTabs = useInNativeTabs();
  const { plus } = useNavSpike();
  // Variant D is added to every page of a tab stack by its layout (TabStackPlus), not here.
  const edge = useVerticalBarEdgeIOS();
  // B without a side column (plain iPhone, iPad) falls back to the floating +.
  const floating = plus === "C" || (plus === "B" && edge === null);
  if (!inNativeTabs || !floating) return null;
  return <FloatingAddButton />;
}

/** SPIKE: variant D on every page of a tab stack (owner, 2026-11-26). Used as the stack's screenLayout. */
export function TabStackPlus({ children }: { children: ReactNode }) {
  const inNativeTabs = useInNativeTabs();
  const { plus } = useNavSpike();
  const edge = useVerticalBarEdgeIOS();
  return (
    <>
      {children}
      {inNativeTabs && plus === "D" ? <ToolbarPlus /> : null}
      {inNativeTabs && plus === "B" && edge !== null ? <HeaderPlus /> : null}
    </>
  );
}

/** Variant B: the + as the first header item, so in the Duo column it sits right under Back. */
function HeaderPlus() {
  const { t } = useTranslation();
  const add = useAddReceiptContext();
  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Button icon="plus" variant="prominent" accessibilityLabel={t("capture.add")} onPress={add.open}>
        {t("capture.add")}
      </Stack.Toolbar.Button>
    </Stack.Toolbar>
  );
}

function ToolbarPlus() {
  const { t } = useTranslation();
  const add = useAddReceiptContext();
  return (
    <Stack.Toolbar placement="bottom">
      <Stack.Toolbar.Spacer />
      <Stack.Toolbar.Button icon="plus" variant="prominent" accessibilityLabel={t("capture.add")} onPress={add.open}>
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
  toolbar = false,
  bleed = false,
}: {
  children: ReactNode;
  toolbar?: boolean;
  /** Full width: backgrounds run under the side column, content pads via ContentInsetsContext. Single pane only. */
  bleed?: boolean;
}) {
  const inNativeTabs = useInNativeTabs();
  const insets = useSafeAreaInsets();
  const { split } = useLayout();
  if (!inNativeTabs) return <TabRootContext.Provider value>{children}</TabRootContext.Provider>;
  if (bleed && !split) {
    return (
      <TabRootContext.Provider value>
        <ContentInsetsContext.Provider value={{ left: insets.left, right: insets.right }}>
          <View style={{ flex: 1 }}>
            {children}
            <TabPlus toolbar={toolbar} />
          </View>
        </ContentInsetsContext.Provider>
      </TabRootContext.Provider>
    );
  }
  return (
    <TabRootContext.Provider value>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingLeft: insets.left, paddingRight: insets.right }}>{children}</View>
        <TabPlus toolbar={toolbar} />
      </View>
    </TabRootContext.Provider>
  );
}
