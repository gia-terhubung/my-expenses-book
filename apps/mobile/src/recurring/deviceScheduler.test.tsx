import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { initI18n } from "@/i18n";

import { deviceScheduler } from "./deviceScheduler";

const m = Notifications as unknown as Record<string, jest.Mock>;
const at = (d: Date) => ({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: 9 as const, minute: 0 as const });
const future = new Date(Date.now() + 5 * 86400000);
const data = { ruleId: "r1", date: "2026-03-15" };

beforeAll(() => initI18n("en"));
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockClear?.());
  Platform.OS = "android";
});
afterAll(() => {
  Platform.OS = "ios";
});

describe("deviceScheduler", () => {
  it("on Android creates the channel before requesting permission and before scheduling", async () => {
    await deviceScheduler.request();
    expect(m.setNotificationChannelAsync).toHaveBeenCalledWith("recurring", expect.objectContaining({ name: "Recurring expenses" }));
    expect(m.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(m.requestPermissionsAsync.mock.invocationCallOrder[0]!);
    await deviceScheduler.schedule({ id: "recurring-r1", title: "t", body: "b", at: at(future), data });
    expect(m.setNotificationChannelAsync).toHaveBeenCalledTimes(2);
    expect(m.setNotificationChannelAsync.mock.invocationCallOrder[1]).toBeLessThan(m.scheduleNotificationAsync.mock.invocationCallOrder[0]!);
    const req = m.scheduleNotificationAsync.mock.calls[0]![0];
    expect(req.trigger.channelId).toBe("recurring");
    expect(req.content.data).toEqual({ tag: "recurring", ...data });
  });

  it("does not create a channel on iOS", async () => {
    Platform.OS = "ios";
    await deviceScheduler.request();
    await deviceScheduler.schedule({ id: "recurring-r1", title: "t", body: "b", at: at(future), data });
    expect(m.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(m.scheduleNotificationAsync.mock.calls[0]![0].trigger.channelId).toBeUndefined();
  });

  it("cancelAll cancels only notifications tagged recurring", async () => {
    m.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      { identifier: "a", content: { data: { tag: "recurring" } } },
      { identifier: "b", content: { data: { tag: "other" } } },
      { identifier: "c", content: { data: null } },
    ]);
    await deviceScheduler.cancelAll("recurring");
    expect(m.cancelScheduledNotificationAsync.mock.calls).toEqual([["a"]]);
  });

  it("skips a time that has already passed", async () => {
    await deviceScheduler.schedule({ id: "recurring-r1", title: "t", body: "b", at: at(new Date(Date.now() - 86400000)), data });
    expect(m.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
