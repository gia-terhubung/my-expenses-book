import * as Notifications from "expo-notifications";

import type { LocalScheduler } from "./notify";

const TAG = "recurring";

/**
 * `LocalScheduler` on expo-notifications: local only (no push token, no network). A DATE trigger at
 * device-local 09:00 works on both platforms (Android has no calendar trigger). Every notification
 * carries `data.tag`, and `cancelAll` removes only those.
 */
export const deviceScheduler: LocalScheduler = {
  async cancelAll() {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((n) => (n.content.data as { tag?: unknown } | null)?.tag === TAG)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  },
  async schedule({ id, title, body, at, data }) {
    const date = new Date(at.year, at.month - 1, at.day, at.hour, at.minute, 0, 0);
    if (date.getTime() <= Date.now()) return;
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, data: { tag: TAG, ...data } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  },
  async permission() {
    const p = await Notifications.getPermissionsAsync();
    return p.granted ? "granted" : p.canAskAgain && p.status === Notifications.PermissionStatus.UNDETERMINED ? "undetermined" : "denied";
  },
  async request() {
    const p = await Notifications.requestPermissionsAsync();
    return p.granted ? "granted" : "denied";
  },
};
