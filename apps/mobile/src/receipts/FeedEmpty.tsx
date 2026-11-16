import { useTranslation } from "react-i18next";
import { View } from "react-native";

import type { CaptureChoice } from "@/capture/CaptureSheet";
import { Button } from "@/components/Button";
import { EmptyState } from "@/layout/EmptyState";
import { useTheme } from "@/theme/ThemeProvider";

/** Empty feed: the same capture paths as the FAB, offered as the obvious next step. */
export function FeedEmpty({ onStart }: { onStart: (mode: CaptureChoice) => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const button = (label: string, mode: CaptureChoice, primary: boolean) => (
    <Button variant={primary ? "primary" : "secondary"} label={label} onPress={() => onStart(mode)} />
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
