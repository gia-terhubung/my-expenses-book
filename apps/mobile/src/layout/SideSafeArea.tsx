import { createContext, useContext, useMemo, type ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";

export type SideInsets = { left: number; right: number };

const SideInsetsContext = createContext<SideInsets | null>(null);

/**
 * Root wrapper that keeps every screen out of the side strips the device reserves: a phone held
 * sideways (notch or camera cutout) or the folded iPhone Duo, whose status area sits on the right
 * (right inset 84, top 0). Top and bottom insets stay with the screens.
 */
export function SideSafeArea({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const value = useMemo(() => ({ left: insets.left, right: insets.right }), [insets.left, insets.right]);
  return (
    <View
      testID="side-safe-area"
      style={{ flex: 1, paddingLeft: insets.left, paddingRight: insets.right, backgroundColor: theme.colors.background }}
    >
      <SideInsetsContext.Provider value={value}>{children}</SideInsetsContext.Provider>
    </View>
  );
}

/** The root side insets (also valid inside modals, which report their own). Falls back to the safe area outside the provider. */
export function useSideInsets(): SideInsets {
  const ctx = useContext(SideInsetsContext);
  const insets = useSafeAreaInsets();
  return useMemo(() => ctx ?? { left: insets.left, right: insets.right }, [ctx, insets.left, insets.right]);
}
