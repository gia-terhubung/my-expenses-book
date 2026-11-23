import { router, type Href } from "expo-router";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button";
import { usePref, usePrefs } from "@/prefs/PrefsProvider";
import { useTheme } from "@/theme/ThemeProvider";

import { SNOOZE_MS, shouldRemindBackup } from "./reminder";

/** Feed banner: nudges a backup after every BACKUP_REMINDER_EVERY confirmed receipts. */
export function BackupReminder() {
  const { t } = useTranslation();
  const theme = useTheme();
  const prefs = usePrefs();
  const receiptsSinceBackup = usePref("receiptsSinceBackup");
  const backupReminderSnoozedUntil = usePref("backupReminderSnoozedUntil");
  if (!shouldRemindBackup({ receiptsSinceBackup, backupReminderSnoozedUntil }, Date.now())) return null;

  const action = (label: string, onPress: () => void, primary: boolean) => (
    <Button
      variant="quiet"
      tone={primary ? "default" : "muted"}
      label={label}
      onPress={onPress}
      style={{ paddingHorizontal: theme.spacing.md }}
    />
  );

  return (
    <View
      testID="backup-reminder"
      style={{
        marginHorizontal: theme.spacing.sm,
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Text style={[theme.type.body, { color: theme.colors.text }]}>
        {t("backup.reminder", { count: receiptsSinceBackup })}
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        {action(t("backup.reminderLater"), () => prefs.set("backupReminderSnoozedUntil", Date.now() + SNOOZE_MS), false)}
        {action(t("backup.reminderNow"), () => router.push("/backup" as unknown as Href), true)}
      </View>
    </View>
  );
}
