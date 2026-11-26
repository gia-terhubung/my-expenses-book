import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { useAddReceiptContext } from "@/capture/AddReceiptProvider";
import { useTheme } from "@/theme/ThemeProvider";

/** SPIKE variant E: "+ Add receipt" in the native tab bar accessory (iOS 26+), with the word. */
export function AccessoryPlus() {
  const theme = useTheme();
  const { t } = useTranslation();
  const add = useAddReceiptContext();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("capture.add")}
      onPress={add.open}
      style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44 }}
    >
      <Ionicons name="add" size={22} color={theme.colors.primary} />
      <Text numberOfLines={1} style={[theme.type.body, { color: theme.colors.primary, fontWeight: "600" }]}>
        {t("capture.add")}
      </Text>
    </Pressable>
  );
}
