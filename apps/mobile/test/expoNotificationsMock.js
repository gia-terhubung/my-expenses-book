// Stand-in for expo-notifications in the jest-expo project (the real module needs native code).
module.exports = {
  SchedulableTriggerInputTypes: { DATE: "date", CALENDAR: "calendar" },
  PermissionStatus: { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" },
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => "id"),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true, status: "undetermined" })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: "granted" })),
  useLastNotificationResponse: jest.fn(() => null),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
};
