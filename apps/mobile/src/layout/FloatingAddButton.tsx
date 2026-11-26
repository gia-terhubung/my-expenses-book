import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Host, Menu, RNHostView } from "@expo/ui/swift-ui";
import { accessibilityLabel } from "@expo/ui/swift-ui/modifiers";
import { useVerticalBarEdgeIOS } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useAddReceiptContext } from "@/capture/AddReceiptProvider";
import { useTheme } from "@/theme/ThemeProvider";

import { PLUS_CHOICES } from "./PlusMenu";

/**
 * The round + floating over the native tab screens (iOS). It sits on the window's outer edge: the
 * side the system puts its vertical bar on ('leading' = left), else the right. Tapping it opens
 * Apple's menu (Scan / Import / Add manually, icon + word), like the + in the Duo side column.
 */
export function FloatingAddButton() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const add = useAddReceiptContext();
  const edge = useVerticalBarEdgeIOS();
  const side = edge === "leading" ? { left: insets.left + 16 } : { right: insets.right + 16 };
  const size = theme.size.plus;

  const circle = (pressed: boolean) => (
    <View
      pointerEvents="none"
      style={[
        styles.plus,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.22), ${theme.elevation.raised}`,
        },
      ]}
    >
      <Ionicons name="add" size={26} color={theme.colors.onPrimary} />
    </View>
  );

  return (
    <View
      testID="floating-add"
      style={[styles.anchor, side, { bottom: insets.bottom + 16, width: size, height: size }]}
    >
      <Host matchContents>
        <Menu label={<RNHostView matchContents>{circle(false)}</RNHostView>} modifiers={[accessibilityLabel(t("capture.add"))]}>
          {PLUS_CHOICES.map((c) => (
            <Button key={c.mode} systemImage={c.icon} label={t(c.key)} onPress={() => void add.start(c.mode)} />
          ))}
        </Menu>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "absolute" },
  plus: { alignItems: "center", justifyContent: "center" },
});
