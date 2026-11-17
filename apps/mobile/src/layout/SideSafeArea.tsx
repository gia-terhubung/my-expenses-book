import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";

/**
 * Root wrapper that keeps every screen out of the side strips the device reserves: a phone held
 * sideways (notch or camera cutout) or the folded iPhone Duo, whose status area sits on the right
 * (right inset 84, top 0). Top and bottom insets stay with the screens.
 */
export function SideSafeArea({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="side-safe-area"
      style={{ flex: 1, paddingLeft: insets.left, paddingRight: insets.right, backgroundColor: theme.colors.background }}
    >
      {children}
    </View>
  );
}
