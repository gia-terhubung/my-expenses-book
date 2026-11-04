import { Tabs } from "expo-router/js-tabs";

import { BottomTabs } from "@/layout/BottomTabBar";
import { SideRail } from "@/layout/SideRail";
import { useWindowClass } from "@/layout/useWindowClass";

/**
 * One Tabs navigator for every window class, so fold/unfold or rotation only swaps the bar
 * (bottom <-> left rail) and never remounts screens or loses the selected tab.
 */
export default function TabsLayout() {
  const windowClass = useWindowClass();
  const compact = windowClass === "compact";

  return (
    <Tabs
      tabBar={(props) => (compact ? <BottomTabs {...props} /> : <SideRail {...props} />)}
      screenOptions={{ headerShown: false, tabBarPosition: compact ? "bottom" : "left" }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="folders" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
