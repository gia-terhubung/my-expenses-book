import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";

/**
 * Fixed top inset for header-less screens. Wrap the scroll view in this instead of padding the
 * scroll content: content padded by the inset scrolls under the transparent Android status bar.
 * `color` paints the strip behind the status bar (Home: the slip green); defaults to the page.
 */
export function StatusBarInset({ children, color }: { children: ReactNode; color?: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View testID="status-bar-inset" style={{ flex: 1, paddingTop: insets.top, backgroundColor: color ?? theme.colors.background }}>
      {children}
    </View>
  );
}
