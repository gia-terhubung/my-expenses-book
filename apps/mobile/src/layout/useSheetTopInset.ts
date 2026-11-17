import { Platform } from "react-native";
import { initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Top padding a `presentationStyle="pageSheet"` modal needs. On iOS the sheet is a card and the
 * system handles the top; on Android it is full screen under the transparent status bar. The
 * modal is a separate window, so fall back to the initial window metrics if the context says 0.
 */
export function useSheetTopInset(): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== "android") return 0;
  return insets.top || initialWindowMetrics?.insets.top || 0;
}
