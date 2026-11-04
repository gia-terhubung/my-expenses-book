import { act, fireEvent, screen, within } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";
import { useSyncExternalStore } from "react";

import { initI18n } from "@/i18n";
import { useWindowClass } from "@/layout/useWindowClass";

import TabsLayout from "@/app/(tabs)/_layout";
import Folders from "@/app/(tabs)/folders";
import Index from "@/app/(tabs)/index";
import Search from "@/app/(tabs)/search";
import Settings from "@/app/(tabs)/settings";

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

function renderApp() {
  return renderRouter(
    { "(tabs)/_layout": TabsLayout, "(tabs)/index": Index, "(tabs)/search": Search, "(tabs)/folders": Folders, "(tabs)/settings": Settings },
    { initialUrl: "/" },
  );
}

beforeAll(() => initI18n("en"));

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
});
