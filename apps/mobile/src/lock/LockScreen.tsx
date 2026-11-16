import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { useTheme } from "@/theme/ThemeProvider";

/** Opaque full-window lock UI. Layout is width-agnostic (centered column) so fold/rotate just reflow. */
export function LockScreen({ onUnlock }: { onUnlock: () => Promise<boolean> }) {
  const { t } = useTranslation();
  const { colors, spacing, type } = useTheme();
  const [failed, setFailed] = useState(false);

  const retry = async () => setFailed(!(await onUnlock()));

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.center,
        { backgroundColor: colors.background, padding: spacing.xl },
      ]}
      testID="lock-screen"
    >
      <View
        style={{
          maxWidth: 420,
          width: "100%",
          alignItems: "center",
          gap: spacing.lg,
        }}
      >
        <Text style={[type.title, { color: colors.text, textAlign: "center" }]}>
          {t("lock.title")}
        </Text>
        {failed ? (
          <Text
            accessibilityRole="alert"
            style={[type.body, { color: colors.danger, textAlign: "center" }]}
          >
            {t("lock.failed")}
          </Text>
        ) : null}
        <Button
          variant="primary"
          label={failed ? t("lock.retry") : t("lock.unlock")}
          onPress={retry}
          style={{ paddingHorizontal: spacing.xl }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
