import { fireEvent, render, screen } from "@testing-library/react-native";

import { BACKUP_REMINDER_EVERY } from "@/backup/reminder";
import { initI18n } from "@/i18n";
import { createPrefs, type PrefsStore } from "@/prefs/prefs";

import { GuideBar, shouldShowGuideBar } from "./GuideBar";

let mockPrefs: PrefsStore;
const mockPush = jest.fn();
jest.mock("@/prefs/PrefsProvider", () => {
  const { usePrefFrom } = jest.requireActual("@/prefs/prefs");
  return { usePrefs: () => mockPrefs, usePref: (k: string) => usePrefFrom(mockPrefs, k) };
});
jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

function memoryPrefs(): PrefsStore {
  const m = new Map<string, string>();
  return createPrefs({ getString: (k) => m.get(k), set: (k, v) => void m.set(k, v), delete: (k) => void m.delete(k) });
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockPrefs = memoryPrefs();
  mockPrefs.set("onboardingStep", "done");
  mockPush.mockClear();
});

describe("shouldShowGuideBar", () => {
  it.each([
    ["done, unseen, no backup due", "done", false, false, true],
    ["already seen", "done", true, false, false],
    ["setup not finished", "lock", false, false, false],
    ["backup reminder due wins", "done", false, true, false],
  ] as const)("%s", (_n, onboardingStep, guideSeen, backupDue, expected) => {
    expect(shouldShowGuideBar({ onboardingStep, guideSeen, backupDue })).toBe(expected);
  });
});

describe("GuideBar", () => {
  it("shows for an existing user who hasn't seen the guide", async () => {
    await render(<GuideBar />);
    expect(screen.getByText("New: a short guide to pay cycle and tax year.")).toBeTruthy();
    // Same 8 pt side margin as the draft banner above it, not flush with the screen edge.
    const { StyleSheet } = jest.requireActual("react-native");
    expect(StyleSheet.flatten(screen.getByTestId("guide-bar").props.style).marginHorizontal).toBe(8);
  });

  it("Dismiss sets guideSeen and hides the bar", async () => {
    const { rerender } = await render(<GuideBar />);
    await fireEvent.press(screen.getByRole("button", { name: "Dismiss" }));
    expect(mockPrefs.get("guideSeen")).toBe(true);
    await rerender(<GuideBar />);
    expect(screen.queryByText("New: a short guide to pay cycle and tax year.")).toBeNull();
  });

  it("Show guide navigates to /guide and sets guideSeen", async () => {
    await render(<GuideBar />);
    await fireEvent.press(screen.getByRole("button", { name: "Show guide" }));
    expect(mockPush).toHaveBeenCalledWith("/guide");
    expect(mockPrefs.get("guideSeen")).toBe(true);
  });

  it("waits while the backup reminder is due", async () => {
    mockPrefs.set("receiptsSinceBackup", BACKUP_REMINDER_EVERY);
    await render(<GuideBar />);
    expect(screen.queryByText("New: a short guide to pay cycle and tax year.")).toBeNull();
  });
});
