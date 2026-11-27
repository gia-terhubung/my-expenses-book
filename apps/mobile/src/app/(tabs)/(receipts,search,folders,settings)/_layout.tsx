import { Stack } from "expo-router";
import { useVerticalBarEdgeIOS } from "expo-status-bar";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { rootStackOptions } from "@/layout/stackOptions";
import { PHOTO_SCREEN_OPTIONS, PhotoRouteContext, SheetRouteContext, TabStackContext } from "@/layout/NativeSheet";
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
 * Each tab has its own Stack (Apple's pattern), so pages opened from a tab keep the tab bar
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
  const ios = Platform.OS === "ios";
  const page = {
    ...base,
    // The + is a header item; keep Back next to it instead of replacing it.
    headerBackVisible: true,
    // iOS: the root does not pad the sides (native bars must reach the Duo column), so pages do.
    // Android: the root SideSafeArea already pads them; padding again would inset twice.
    contentStyle: ios ? { ...base.contentStyle, paddingLeft: insets.left, paddingRight: insets.right } : base.contentStyle,
  };
  const SCREEN_OPTIONS: Record<string, object> = {
    // Create/edit pages: a sheet over the tabs (no tab bar, no +), X and checkmark.
    "recurring/[id]": { ...page, presentation: "modal", headerShown: true },
    // iOS: any sheet body as a native sheet page (NativeSheetHost).
    sheet: { ...page, presentation: "modal", headerShown: true },
    photo: { ...page, ...PHOTO_SCREEN_OPTIONS },
    // iOS: native filter sheet with Apple's bar (Cancel, Apply).
    "search-filter": { ...page, presentation: "modal", headerShown: true, title: t("search.filters") },
  };
  return (
    <Stack
      screenLayout={({ children, route }) => (
        <TabStackContext.Provider value>
          <SheetRouteContext.Provider value="/sheet">
            <PhotoRouteContext.Provider value="/photo">
              <TabStackPlus routeName={route.name}>{children}</TabStackPlus>
            </PhotoRouteContext.Provider>
          </SheetRouteContext.Provider>
        </TabStackContext.Provider>
      )}
      // Per-route options live here, not in <Stack.Screen> children: declared children reorder the
      // stack's routes after its state was first built (anchor first), and the first re-render (the
      // language set during onboarding) then sends ROUTE_NAMES_CHANGED, which the stacks of tabs not
      // on screen cannot handle.
      // iOS only: native sheets and the photo page; on Android these routes keep their own headers.
      screenOptions={({ route }) => (ios && SCREEN_OPTIONS[route.name]) || (TAB_ROOTS.has(route.name) ? rootHeader : page)}
    />
  );
}
