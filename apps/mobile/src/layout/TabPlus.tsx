import { Stack } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useAddReceiptContext } from "@/capture/AddReceiptProvider";

import { FloatingAddButton } from "./FloatingAddButton";
import { ContentInsetsContext, useInNativeTabs, useNavSpike } from "./navSpike";
import { useLayout } from "./useLayout";

/**
 * SPIKE: the + on an iOS native tab screen. Rendered inside each tab screen so it reads that
 * screen's safe area (NativeTabs gives each tab its own, which already includes the tab bar or the
 * Duo side column). Variant D (native bottom toolbar) exists only on Receipts (its own Stack);
 * the other tabs keep variant C so the + is never missing. Renders nothing off iOS native tabs.
 */
export function TabPlus({ toolbar = false }: { toolbar?: boolean }) {
  const inNativeTabs = useInNativeTabs();
  const { plus } = useNavSpike();
  if (!inNativeTabs) return null;
  if (plus === "D" && toolbar) return <ToolbarPlus />;
  return <FloatingAddButton />;
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
  if (!inNativeTabs) return <>{children}</>;
  if (bleed && !split) {
    return (
      <ContentInsetsContext.Provider value={{ left: insets.left, right: insets.right }}>
        <View style={{ flex: 1 }}>
          {children}
          <TabPlus toolbar={toolbar} />
        </View>
      </ContentInsetsContext.Provider>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingLeft: insets.left, paddingRight: insets.right }}>{children}</View>
      <TabPlus toolbar={toolbar} />
    </View>
  );
}
