import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { initI18n } from "@/i18n";
import { createPrefs, type PrefsStore } from "@/prefs/prefs";

import { BackupReminder } from "./BackupReminder";
import { SNOOZE_MS } from "./reminder";

let mockPrefs: PrefsStore;
const mockPush = jest.fn();

jest.mock("@/prefs/PrefsProvider", () => {
  const { usePrefFrom } = jest.requireActual("@/prefs/prefs");
  return {
    usePrefs: () => mockPrefs,
    usePref: (k: string) => usePrefFrom(mockPrefs, k),
  };
});
jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

function memoryPrefs(): PrefsStore {
  const m = new Map<string, string>();
  return createPrefs({ getString: (k) => m.get(k), set: (k, v) => void m.set(k, v), delete: (k) => void m.delete(k) });
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockPrefs = memoryPrefs();
  mockPush.mockClear();
});

describe("BackupReminder", () => {
  it("renders nothing below the threshold", async () => {
    mockPrefs.set("receiptsSinceBackup", 19);
    await render(<BackupReminder />);
    expect(screen.queryByText("Back up")).toBeNull();
  });

  it("shows the count and opens the backup screen", async () => {
    mockPrefs.set("receiptsSinceBackup", 20);
    await render(<BackupReminder />);
    expect(screen.getByText("20 receipts since your last backup")).toBeTruthy();
    await fireEvent.press(screen.getByText("Back up"));
    expect(mockPush).toHaveBeenCalledWith("/backup");
  });

  it("Later snoozes for 7 days and hides", async () => {
    mockPrefs.set("receiptsSinceBackup", 20);
    const now = jest.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
    await render(<BackupReminder />);
    await fireEvent.press(screen.getByText("Later"));
    expect(mockPrefs.get("backupReminderSnoozedUntil")).toBe(1_800_000_000_000 + SNOOZE_MS);
    expect(screen.queryByText("Later")).toBeNull();
    now.mockRestore();
  });

  it("stays hidden while snoozed", async () => {
    mockPrefs.set("receiptsSinceBackup", 30);
    mockPrefs.set("backupReminderSnoozedUntil", Date.now() + 60_000);
    await render(<BackupReminder />);
    expect(screen.queryByText("Later")).toBeNull();
  });
});
