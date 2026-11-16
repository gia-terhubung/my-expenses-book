import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { setStatusBarStyle } from "expo-status-bar";
import { useSyncExternalStore } from "react";

import { testDb } from "@/db/testing/testDb";
import { initI18n } from "@/i18n";
import { useWindowClass } from "@/layout/useWindowClass";

import TabsLayout from "@/app/(tabs)/_layout";
import Folders from "@/app/(tabs)/folders";
import Index from "@/app/(tabs)/index";
import Search from "@/app/(tabs)/search";
import Settings from "@/app/(tabs)/settings";

// Settings reads prefs; the real provider needs native crypto/MMKV.
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => ({ language: "en", homeCurrency: "USD", taxYearStartMonth: 1, lockEnabled: false, lockTimeout: 60 })[k],
  usePrefs: () => ({ set: jest.fn() }),
}));
// Receipts reads drafts ("Continue reviewing"); the real DB provider needs native SQLCipher.
let mockDb: unknown = null;
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
let mockDrafts: string[] = [];
jest.mock("@/db/repositories/receipts", () => ({
  ...jest.requireActual("@/db/repositories/receipts"),
  listDraftIds: () => mockDrafts,
}));
// Receipts' detail pane opens photos; the real image store needs native crypto.
jest.mock("@/images/ImageStoreProvider", () => ({
  useImageStore: () => ({ openForView: jest.fn(), deleteFiles: jest.fn(), closeViews: jest.fn() }),
}));
jest.mock("expo-local-authentication", () => ({
  getEnrolledLevelAsync: jest.fn().mockResolvedValue(1),
  SecurityLevel: { NONE: 0, SECRET: 1 },
}));

jest.mock("expo-status-bar", () => ({ ...jest.requireActual("expo-status-bar"), setStatusBarStyle: jest.fn() }));

// Mutable window class that re-renders subscribers, like a real resize would.
type WC = "compact" | "medium" | "expanded";
let current: WC = "compact";
const listeners = new Set<() => void>();
const setClass = (c: WC) => {
  current = c;
  listeners.forEach((l) => l());
};
jest.mock("@/layout/useWindowClass");
(useWindowClass as jest.Mock).mockImplementation(() =>
  useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => current),
);

const LABELS = ["Receipts", "Search", "Folders", "Settings"];

const ReviewStub = () => null;

function renderApp() {
  return renderRouter(
    {
      "(tabs)/_layout": TabsLayout,
      "(tabs)/index": Index,
      "(tabs)/search": Search,
      "(tabs)/folders": Folders,
      "(tabs)/settings": Settings,
      "review/[id]": ReviewStub,
    },
    { initialUrl: "/" },
  );
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
  mockDrafts = [];
  (setStatusBarStyle as jest.Mock).mockClear();
});

describe("tabs layout", () => {
  it("compact: bottom tab bar, no side rail, 4 labels", async () => {
    setClass("compact");
    await renderApp();
    expect(await screen.findByTestId("tab-bar")).toBeTruthy();
    expect(screen.queryByTestId("side-rail")).toBeNull();
    for (const l of LABELS) expect(within(screen.getByTestId("tab-bar")).getByText(l)).toBeTruthy();
  });

  it.each(["medium", "expanded"])("%s: side rail, no tab bar, 4 labels", async (cls) => {
    setClass(cls as WC);
    await renderApp();
    expect(await screen.findByTestId("side-rail")).toBeTruthy();
    expect(screen.queryByTestId("tab-bar")).toBeNull();
    for (const l of LABELS) expect(within(screen.getByTestId("side-rail")).getByText(l)).toBeTruthy();
  });

  it("switching window class keeps the selected tab and rail/bar swap", async () => {
    setClass("compact");
    await renderApp();
    const bar = await screen.findByTestId("tab-bar");
    await act(async () => fireEvent.press(within(bar).getByText("Settings")));
    expect(screen).toHavePathname("/settings");
    await act(async () => setClass("expanded"));
    expect(screen.getByTestId("side-rail")).toBeTruthy();
    expect(screen.queryByTestId("tab-bar")).toBeNull();
    expect(screen).toHavePathname("/settings");
    await act(async () => setClass("compact"));
    expect(screen.getByTestId("tab-bar")).toBeTruthy();
    expect(screen).toHavePathname("/settings");
  });

  it("Receipts: 'Continue reviewing (N)' opens the oldest draft with the rest queued", async () => {
    setClass("compact");
    mockDrafts = ["d1", "d2", "d3"];
    await renderApp();
    const banner = await screen.findByText("Continue reviewing (3)");
    await act(async () => fireEvent.press(banner));
    expect(screen).toHavePathname("/review/d1");
    expect(screen).toHaveSearchParams({ id: "d1", queue: "d2,d3" });
  });

  it("Receipts: the draft banner is announced as its visible text only (no dot, no chevron)", async () => {
    setClass("compact");
    mockDrafts = ["d1", "d2"];
    await renderApp();
    const banner = await screen.findByRole("button", { name: "Continue reviewing (2)" });
    expect(banner.props.accessibilityLabel).toBe("Continue reviewing (2)");
  });

  it("Receipts: light status-bar icons over the green slip while focused, themed again on blur", async () => {
    setClass("compact");
    await renderApp();
    await screen.findByTestId("tab-bar");
    expect(setStatusBarStyle).toHaveBeenLastCalledWith("light");
    await act(async () => fireEvent.press(within(screen.getByTestId("tab-bar")).getByText("Settings")));
    expect(setStatusBarStyle).toHaveBeenLastCalledWith("dark");
  });

  it("Receipts on wide layouts keeps the themed icons (the rail and detail pane are not green)", async () => {
    setClass("expanded");
    await renderApp();
    await screen.findByTestId("side-rail");
    expect(setStatusBarStyle).not.toHaveBeenCalledWith("light");
  });
});
