import type { ReactNode } from "react";
import { View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

import { useSideInsets } from "./SideSafeArea";

/**
 * Keeps the content of a native modal out of the side strips (the folded iPhone Duo's status
 * area, a camera cutout). A modal is its own native window, outside `SideSafeArea`, so it reads
 * the root side insets that `SideSafeArea` publishes. Top and bottom stay with the screens.
 */
export function ModalSideInset({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { left, right } = useSideInsets();
  return (
    <View
      testID="modal-side-inset"
      style={{ flex: 1, paddingLeft: left, paddingRight: right, backgroundColor: theme.colors.background }}
    >
      {children}
    </View>
  );
}
