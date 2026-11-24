import { router, type Href } from "expo-router";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { shouldRemindBackup } from "@/backup/reminder";
import { Button } from "@/components/Button";
import type { OnboardingStep } from "@/prefs/prefs";
import { usePref, usePrefs } from "@/prefs/PrefsProvider";
import { useTheme } from "@/theme/ThemeProvider";

/** Existing users only (setup done before the guide existed), and never on top of a due backup reminder. */
export function shouldShowGuideBar(p: { onboardingStep: OnboardingStep; guideSeen: boolean; backupDue: boolean }): boolean {
  return p.onboardingStep === "done" && !p.guideSeen && !p.backupDue;
}

/** One-time Home bar pointing existing users to the new guide. Same look as the backup reminder. */
export function GuideBar() {
  const { t } = useTranslation();
  const theme = useTheme();
  const prefs = usePrefs();
  const onboardingStep = usePref("onboardingStep");
  const guideSeen = usePref("guideSeen");
  const receiptsSinceBackup = usePref("receiptsSinceBackup");
  const backupReminderSnoozedUntil = usePref("backupReminderSnoozedUntil");
  // eslint-disable-next-line react-hooks/purity -- same wall-clock check as BackupReminder
  const backupDue = shouldRemindBackup({ receiptsSinceBackup, backupReminderSnoozedUntil }, Date.now());
  if (!shouldShowGuideBar({ onboardingStep, guideSeen, backupDue })) return null;

  const seen = () => prefs.set("guideSeen", true);
  const action = (label: string, onPress: () => void, primary: boolean) => (
    // The main action is the yellow nudge button (Home's attention colour); the other is an outline.
    <Button
      variant={primary ? "highlight" : "quiet"}
      tone={primary ? "default" : "muted"}
      label={label}
      onPress={onPress}
      style={{ paddingHorizontal: theme.spacing.md }}
    />
  );

  return (
    <View
      testID="guide-bar"
      style={{
        marginHorizontal: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Text style={[theme.type.body, { color: theme.colors.text }]}>{t("guide.bar.text")}</Text>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
        {action(t("guide.bar.dismiss"), seen, false)}
        {action(
          t("guide.bar.open"),
          () => {
            seen();
            router.push("/guide" as unknown as Href);
          },
          true,
        )}
      </View>
    </View>
  );
}
