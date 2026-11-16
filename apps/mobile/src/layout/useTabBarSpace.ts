import { BottomTabBarHeightContext } from "expo-router/js-tabs";
import { useContext } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";

import { useWindowClass } from "./useWindowClass";

/** Gap between the floating bar and the system bottom inset. */
export const TAB_BAR_LIFT = 12;

/**
 * Bottom padding a scrolling tab screen needs so its last row clears the floating tab bar:
 * inset + lift + capsule + 24 on compact, 0 on wide layouts (side rail). Also 0 outside the tabs
 * navigator (stack screens such as a folder or a document reuse the same lists with no bar).
 */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const compact = useWindowClass() === "compact";
  const inTabs = useContext(BottomTabBarHeightContext) !== undefined;
  return compact && inTabs ? insets.bottom + TAB_BAR_LIFT + theme.size.capsule + 24 : 0;
}
