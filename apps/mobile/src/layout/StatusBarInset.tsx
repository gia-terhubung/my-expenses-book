import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";

/**
 * Fixed top inset for header-less screens. Wrap the scroll view in this instead of padding the
 * scroll content: content padded by the inset scrolls under the transparent Android status bar.
 */
export function StatusBarInset({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View testID="status-bar-inset" style={{ flex: 1, paddingTop: insets.top, backgroundColor: theme.colors.background }}>
      {children}
    </View>
  );
}
