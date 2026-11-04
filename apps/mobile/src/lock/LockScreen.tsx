import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

/** Opaque full-window lock UI. Layout is width-agnostic (centered column) so fold/rotate just reflow. */
export function LockScreen({ onUnlock }: { onUnlock: () => Promise<boolean> }) {
  const { t } = useTranslation();
  const { colors, spacing, radius, type } = useTheme();
  const [failed, setFailed] = useState(false);

  const retry = async () => setFailed(!(await onUnlock()));

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background, padding: spacing.xl }]}
      testID="lock-screen"
    >
      <View style={{ maxWidth: 420, width: "100%", alignItems: "center", gap: spacing.lg }}>
        <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>{t("lock.title")}</Text>
        {failed ? (
          <Text accessibilityRole="alert" style={[type.body, { color: colors.danger, textAlign: "center" }]}>
            {t("lock.failed")}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={retry}
          style={{
            backgroundColor: colors.primary,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.xl,
            minHeight: 48,
            justifyContent: "center",
          }}
        >
          <Text style={[type.body, { color: colors.onPrimary, fontWeight: "600" }]}>
            {failed ? t("lock.retry") : t("lock.unlock")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: "center", justifyContent: "center" } });
