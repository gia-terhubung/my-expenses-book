import { Tabs } from "expo-router/js-tabs";

import { AddReceiptProvider } from "@/capture/AddReceiptProvider";
import { BottomTabs } from "@/layout/BottomTabBar";
import { SideRail } from "@/layout/SideRail";
import { useLayout } from "@/layout/useLayout";

/**
 * One Tabs navigator for every layout, so fold/unfold or rotation only swaps the bar
 * (bottom <-> left rail) and never remounts screens or loses the selected tab. The add sheet is
 * owned here, above both bars.
 */
export default function TabsLayout() {
  const bar = useLayout().nav === "bar";

  return (
    <AddReceiptProvider>
      <Tabs
        tabBar={(props) => (bar ? <BottomTabs {...props} /> : <SideRail {...props} />)}
        screenOptions={{ headerShown: false, tabBarPosition: bar ? "bottom" : "left" }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="folders" />
        <Tabs.Screen name="settings" />
      </Tabs>
    </AddReceiptProvider>
  );
}
