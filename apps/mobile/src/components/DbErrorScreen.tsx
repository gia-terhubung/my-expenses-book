import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Text, TextInput, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

const CONFIRM_WORD = "RESET";

/** Shown by DatabaseProvider when the data cannot be unlocked. Reset is destructive and confirmed. */
export function DbErrorScreen({ onReset }: { onReset: () => void | Promise<void> }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [typed, setTyped] = useState("");
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        padding: theme.spacing.xl,
        gap: theme.spacing.lg,
        backgroundColor: theme.colors.background,
      }}
    >
      <Text style={[theme.type.title, { color: theme.colors.text }]}>{t("dbError.title")}</Text>
      <Text style={[theme.type.body, { color: theme.colors.text }]}>{t("dbError.body")}</Text>
      <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>
        {t("dbError.resetWarning", { word: CONFIRM_WORD })}
      </Text>
      <TextInput
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={CONFIRM_WORD}
        placeholderTextColor={theme.colors.textMuted}
        style={{
          borderWidth: 1,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          color: theme.colors.text,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        }}
      />
      <Button
        title={t("dbError.resetButton")}
        color={theme.colors.danger}
        disabled={typed !== CONFIRM_WORD}
        onPress={onReset}
      />
    </View>
  );
}
