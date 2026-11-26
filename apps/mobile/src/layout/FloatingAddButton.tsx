import Ionicons from "@expo/vector-icons/Ionicons";
import { useVerticalBarEdgeIOS } from "expo-status-bar";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useAddReceiptContext } from "@/capture/AddReceiptProvider";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * The round + floating over the native tab screens (iOS, variant C). It sits on the window's
 * outer edge: the side the system puts its vertical bar on ('leading' = left), else the right.
 * On the iPhone Duo the side column is inside the safe area insets, so + 16 clears it.
 */
export function FloatingAddButton() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const add = useAddReceiptContext();
  const edge = useVerticalBarEdgeIOS();
  const side = edge === "leading" ? { left: insets.left + 16 } : { right: insets.right + 16 };

  return (
    <Pressable
      testID="floating-add"
      accessibilityRole="button"
      accessibilityLabel={t("capture.add")}
      onPress={add.open}
      style={({ pressed }) => [
        styles.plus,
        side,
        {
          bottom: insets.bottom + 16,
          width: theme.size.plus,
          height: theme.size.plus,
          borderRadius: theme.size.plus / 2,
          backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.22), ${theme.elevation.raised}`,
        },
      ]}
    >
      <Ionicons name="add" size={26} color={theme.colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plus: { position: "absolute", alignItems: "center", justifyContent: "center" },
});
