import { Stack } from "expo-router";
import { Platform } from "react-native";

import { useTranslation } from "react-i18next";

import { SheetRouteContext } from "@/layout/NativeSheet";
import { useSideInsets } from "@/layout/SideSafeArea";
import { rootStackOptions } from "@/layout/stackOptions";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Capture + review flow, presented as one native modal (root Stack: presentation "modal"). On iOS
 * the modal is its own window, so the stack is padded by the root side insets here. On Android the
 * native-stack modal renders inside the root ScreenStack, already inside SideSafeArea: padding it
 * again would inset twice.
 */
export default function ModalsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const side = useSideInsets();
  if (Platform.OS !== "ios") return <Stack screenOptions={{ headerShown: false }} />;
  // iOS: pad the screen content, not the stack, so native headers reach the Duo side column.
  const base = rootStackOptions(t, theme.colors);
  return (
    <Stack
      // Pickers opened from these screens (currency) open as native sheet pages on `picker`.
      screenLayout={({ children }) => (
        <SheetRouteContext.Provider value="/picker">{children}</SheetRouteContext.Provider>
      )}
      // Per-route options here, not in <Stack.Screen> children, so the route order never changes after
      // the stack's state is built (see the tab stacks' ROUTE_NAMES_CHANGED fix).
      screenOptions={({ route }) => ({
        ...base,
        contentStyle: { ...base.contentStyle, paddingLeft: side.left, paddingRight: side.right },
        ...(route.name === "picker" ? { presentation: "modal" as const, headerShown: true } : null),
      })}
    />
  );
}
