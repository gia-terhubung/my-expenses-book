import { Stack } from "expo-router";
import { useVerticalBarEdgeIOS } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { rootStackOptions } from "@/layout/stackOptions";
import { SheetRouteContext, TabStackContext } from "@/layout/NativeSheet";
import { TabStackPlus } from "@/layout/TabPlus";
import { useTheme } from "@/theme/ThemeProvider";

/** Each tab's first page (expo-router reads a group's own key, without the brackets). */
export const unstable_settings = {
  anchor: "index",
  search: { anchor: "search" },
  folders: { anchor: "folders" },
  settings: { anchor: "settings" },
};
const TAB_ROOTS = new Set(["index", "search", "folders", "settings"]);

/**
 * SPIKE: each tab has its own Stack (Apple's pattern), so pages opened from a tab keep the tab bar
 * (on the iPhone Duo: the side column). Shared group: every tab can open the same pages.
 * Tab roots pad themselves (TabScreen); pages pushed on top pad by the tab's side insets here.
 */
export default function TabStack() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const base = rootStackOptions(t, theme.colors);
  const edge = useVerticalBarEdgeIOS();
  // On a side column: tab roots get an empty, see-through header so the + can sit in it.
  const rootHeader =
    edge !== null
      ? {
          ...base,
          headerShown: true,
          title: "",
          headerTransparent: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "transparent" },
          scrollEdgeEffects: { top: "hidden" as const, bottom: "hidden" as const, left: "hidden" as const, right: "hidden" as const },
        }
      : base;
  return (
    <Stack
      screenLayout={({ children, route }) => (
        <TabStackContext.Provider value>
          <SheetRouteContext.Provider value="/sheet">
            <TabStackPlus routeName={route.name}>{children}</TabStackPlus>
          </SheetRouteContext.Provider>
        </TabStackContext.Provider>
      )}
      screenOptions={({ route }) =>
        TAB_ROOTS.has(route.name)
          ? rootHeader
          : {
              ...base,
              // The + is a header item; keep Back next to it instead of replacing it.
              headerBackVisible: true,
              contentStyle: { ...base.contentStyle, paddingLeft: insets.left, paddingRight: insets.right },
            }
      }
    >
      {/* SPIKE (iOS): any sheet body as a native sheet page (NativeSheetHost). */}
      {/* Create/edit pages: a sheet over the tabs (no tab bar, no +), X and checkmark (owner, 2026-11-26). */}
      <Stack.Screen name="recurring/[id]" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen name="sheet" options={{ presentation: "modal", headerShown: true }} />
      <Stack.Screen
        name="photo"
        options={{
          presentation: "fullScreenModal",
          // A header (empty, see-through) keeps the native toolbar for the checkmark.
          headerShown: true,
          headerTransparent: true,
          title: "",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "transparent" },
          headerTintColor: "#fff",
          statusBarStyle: "light",
          contentStyle: { backgroundColor: "#000" },
        }}
      />
      {/* SPIKE (iOS): native filter sheet with Apple's bar (Cancel, Apply). */}
      <Stack.Screen name="search-filter" options={{ presentation: "modal", headerShown: true, title: t("search.filters") }} />
    </Stack>
  );
}
