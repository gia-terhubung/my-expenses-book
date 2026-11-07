/** Remind after this many receipts are confirmed since the last backup. */
export const BACKUP_REMINDER_EVERY = 20;
/** "Later" hides the reminder for 7 days. */
export const SNOOZE_MS = 7 * 24 * 3600 * 1000;

export function shouldRemindBackup(
  p: { receiptsSinceBackup: number; backupReminderSnoozedUntil: number | null },
  now: number,
): boolean {
  if (p.receiptsSinceBackup < BACKUP_REMINDER_EVERY) return false;
  return p.backupReminderSnoozedUntil === null || p.backupReminderSnoozedUntil <= now;
}
