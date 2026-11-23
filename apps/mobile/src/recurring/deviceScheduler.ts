import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";

import { i18n } from "@/i18n";

import type { LocalScheduler } from "./notify";

const TAG = "recurring";
const CHANNEL = "recurring";

/** Android 8+ needs a channel for any notification, and 13+ shows the permission prompt only once one exists. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: i18n.t("recurring.channelName"),
    importance: AndroidImportance.DEFAULT,
  });
}

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
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title, body, data: { tag: TAG, ...data } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        ...(Platform.OS === "android" ? { channelId: CHANNEL } : {}),
      },
    });
  },
  async permission() {
    const p = await Notifications.getPermissionsAsync();
    // On Android 13+, a first-time (never-asked) permission returns status "denied"
    // but canAskAgain=true. Treat canAskAgain as the canonical "not yet asked" signal
    // so that ensurePermissionForDraftRule can trigger the system prompt on both platforms.
    if (p.granted) return "granted";
    if (p.canAskAgain) return "undetermined";
    return "denied";
  },
  async request() {
    await ensureChannel();
    const p = await Notifications.requestPermissionsAsync();
    return p.granted ? "granted" : "denied";
  },
};
