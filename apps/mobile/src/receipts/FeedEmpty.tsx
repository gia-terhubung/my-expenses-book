import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import type { CaptureChoice } from "@/capture/CaptureSheet";
import { EmptyState } from "@/layout/EmptyState";
import { useTheme } from "@/theme/ThemeProvider";

/** Empty feed: the same capture paths as the FAB, offered as the obvious next step. */
export function FeedEmpty({ onStart }: { onStart: (mode: CaptureChoice) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const button = (label: string, mode: CaptureChoice, primary: boolean) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => onStart(mode)}
      style={({ pressed }) => ({
        minHeight: 48,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radius.md,
        backgroundColor: primary ? theme.colors.primary : theme.colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={[theme.type.body, { color: primary ? theme.colors.onPrimary : theme.colors.primary, fontWeight: "600" }]}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <EmptyState title={t("tabs.receipts")} message={t("empty.receipts")} topInset={false}>
      <View style={{ gap: theme.spacing.sm, maxWidth: 360 }}>
        {button(t("empty.scanFirst"), "scan", true)}
        {button(t("empty.addManually"), "manual", false)}
      </View>
    </EmptyState>
  );
}
