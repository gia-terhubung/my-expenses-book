import { Tabs } from "expo-router/js-tabs";
import { NativeTabs } from "expo-router/native-tabs";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";

import { AddReceiptProvider } from "@/capture/AddReceiptProvider";
import { BottomTabs } from "@/layout/BottomTabBar";
import { NativeTabsContext, useNavSpike } from "@/layout/navSpike";
import { SideRail } from "@/layout/SideRail";
import { TAB_LABEL_KEYS, TAB_ROUTES, TAB_SF_SYMBOLS } from "@/layout/tabs";
import { useLayout } from "@/layout/useLayout";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * iOS: Apple's native tabs, so the iPhone Duo can move them into its side column and the open Duo
 * and the iPad can show a sidebar. Elsewhere: one JS Tabs navigator for every layout, so
 * fold/unfold or rotation only swaps the bar (bottom <-> left rail) and never remounts screens or
 * loses the selected tab. The add sheet is owned here, above every bar.
 */
export default function TabsLayout() {
  return <AddReceiptProvider>{Platform.OS === "ios" ? <IosTabs /> : <JsTabs />}</AddReceiptProvider>;
}

function IosTabs() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { placement } = useNavSpike();
  return (
    <NativeTabsContext.Provider value>
      <NativeTabs preferredPlacement={placement} tintColor={theme.colors.primary}>
        {TAB_ROUTES.map((name) => (
          <NativeTabs.Trigger key={name} name={name}>
            <NativeTabs.Trigger.Icon sf={TAB_SF_SYMBOLS[name]} />
            <NativeTabs.Trigger.Label>{t(TAB_LABEL_KEYS[name])}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    </NativeTabsContext.Provider>
  );
}

function JsTabs() {
  const { nav } = useLayout();
  const bar = nav === "bar";
  return (
    <Tabs
      tabBar={(props) => (bar ? <BottomTabs {...props} /> : <SideRail {...props} variant={nav === "iconRail" ? "icons" : "labels"} />)}
      screenOptions={{ headerShown: false, tabBarPosition: bar ? "bottom" : "left" }}
    >
      {TAB_ROUTES.map((name) => (
        <Tabs.Screen key={name} name={name} />
      ))}
    </Tabs>
  );
}
