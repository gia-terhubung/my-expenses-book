// Placeholder (Ruling A): Task 11 replaces this with the draft review screen.
import { router, useLocalSearchParams } from "expo-router";
import { Button, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/layout/EmptyState";
import { useTheme } from "@/theme/ThemeProvider";

export default function ReviewPlaceholder() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { id, queue, failed, total } = useLocalSearchParams<{ id: string; queue?: string; failed?: string; total?: string }>();
  const remaining = queue ? queue.split(",").filter(Boolean).length : 0;
  const failedCount = Number(failed ?? 0);
  return (
    <EmptyState title={t("review.title")} message={t("review.placeholder", { id })}>
      {remaining > 0 ? (
        <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{t("review.queued", { n: remaining })}</Text>
      ) : null}
      {failedCount > 0 ? (
        <Text style={[theme.type.body, { color: theme.colors.danger }]}>
          {t("capture.failedSome", { failed: failedCount, total: Number(total ?? failedCount) })}
        </Text>
      ) : null}
      <Button title={t("common.done")} onPress={() => router.back()} />
    </EmptyState>
  );
}
