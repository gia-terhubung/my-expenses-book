import { BACKUP_REMINDER_EVERY, SNOOZE_MS, shouldRemindBackup } from "./reminder";

const NOW = 1_800_000_000_000;

describe("shouldRemindBackup", () => {
  it("constants", () => {
    expect(BACKUP_REMINDER_EVERY).toBe(20);
    expect(SNOOZE_MS).toBe(7 * 24 * 3600 * 1000);
  });
  it("is false below the threshold", () => {
    expect(shouldRemindBackup({ receiptsSinceBackup: 19, backupReminderSnoozedUntil: null }, NOW)).toBe(false);
  });
  it("is true at the threshold", () => {
    expect(shouldRemindBackup({ receiptsSinceBackup: 20, backupReminderSnoozedUntil: null }, NOW)).toBe(true);
  });
  it("is false while snoozed", () => {
    expect(shouldRemindBackup({ receiptsSinceBackup: 20, backupReminderSnoozedUntil: NOW + 1 }, NOW)).toBe(false);
  });
  it("is true once the snooze has passed", () => {
    expect(shouldRemindBackup({ receiptsSinceBackup: 20, backupReminderSnoozedUntil: NOW - 1 }, NOW)).toBe(true);
    expect(shouldRemindBackup({ receiptsSinceBackup: 25, backupReminderSnoozedUntil: NOW }, NOW)).toBe(true);
  });
});
