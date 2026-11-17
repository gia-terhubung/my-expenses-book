import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { BottomTabBarHeightContext, type BottomTabBarProps } from "expo-router/js-tabs";
import { StyleSheet, Text } from "react-native";

import { AddReceiptProvider } from "@/capture/AddReceiptProvider";
import { initI18n } from "@/i18n";
import { tokens } from "@/theme/tokens";

import { BottomTabs } from "./BottomTabBar";
import { useTabBarSpace } from "./useTabBarSpace";
import { useWindowClass } from "./useWindowClass";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 47, left: 0, right: 0 }),
}));
// The add sheet's capture flow reads the DB and prefs; the real providers need native modules.
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => null }));
jest.mock("@/prefs/PrefsProvider", () => ({ usePref: () => "IDR" }));

jest.mock("./useWindowClass", () => ({ useWindowClass: jest.fn(() => "compact") }));

const light = tokens.light;
const ROUTES = ["index", "search", "folders", "settings"];

const props = (index = 0) =>
  ({
    state: { index, routes: ROUTES.map((name) => ({ key: `${name}-key`, name })) },
    navigateToTab: jest.fn(),
  }) as unknown as BottomTabBarProps;

function flat(node: { props: { style?: unknown } }) {
  const s = node.props.style;
  return StyleSheet.flatten(typeof s === "function" ? s({ pressed: false }) : (s as object));
}

beforeAll(() => initI18n("id"));

const renderBar = (index = 0) =>
  render(
    <AddReceiptProvider>
      <BottomTabs {...props(index)} />
    </AddReceiptProvider>,
  );

describe("BottomTabs (floating duo)", () => {
  it("renders a tablist with 4 tabs and a separate add button labelled Tambah struk", async () => {
    await renderBar();
    // A plain container View is not an accessibility element, so find it by testID and check its role.
    const tablist = screen.getByTestId("tab-capsule");
    expect(tablist.props.accessibilityRole).toBe("tablist");
    expect(within(tablist).getAllByRole("tab")).toHaveLength(4);
    const add = screen.getByRole("button", { name: "Tambah struk" });
    expect(within(tablist).queryByRole("button", { name: "Tambah struk" })).toBeNull();
    expect(add).toBeTruthy();
  });

  it("bar sits insets.bottom + 12 above the screen bottom", async () => {
    await renderBar();
    expect(flat(screen.getByTestId("tab-bar"))).toMatchObject({ position: "absolute", bottom: 59, left: 12, right: 12 });
  });

  it("each tab's accessible name is its label only, icon hidden from a11y", async () => {
    await renderBar();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(["Struk", "Cari", "Folder", "Pengaturan"]);
    for (const tab of tabs) {
      const icon = tab.children[0] as { props: Record<string, unknown> };
      expect(icon.props.accessible).toBe(false);
      expect(icon.props.importantForAccessibility).toBe("no");
    }
  });

  it("tab labels cap font scaling at 1.3", async () => {
    await renderBar();
    for (const label of ["Struk", "Cari", "Folder", "Pengaturan"]) {
      expect(screen.getByText(label).props.maxFontSizeMultiplier).toBe(1.3);
    }
  });

  it("tab labels shrink to fit on one line instead of ellipsizing", async () => {
    await renderBar();
    for (const label of ["Struk", "Cari", "Folder", "Pengaturan"]) {
      expect(screen.getByText(label).props).toMatchObject({
        numberOfLines: 1,
        adjustsFontSizeToFit: true,
        minimumFontScale: 0.75,
      });
    }
  });

  it("focused tab has the tonal pill", async () => {
    await renderBar(1);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[1].props.accessibilityState).toMatchObject({ selected: true });
    expect(flat(tabs[1]).backgroundColor).toBe(light.colors.tonal);
    expect(flat(screen.getByText("Cari")).color).toBe(light.colors.primary);
    expect(flat(tabs[0]).backgroundColor).toBeUndefined();
    expect(flat(screen.getByText("Struk")).color).toBe(light.colors.textMuted);
  });

  it("pressing + opens the provider's sheet; the bar renders no sheet of its own", async () => {
    await renderBar();
    expect(screen.queryByTestId("capture-sheet")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Tambah struk" }));
    expect(screen.getAllByTestId("capture-sheet")).toHaveLength(1);
  });

  it("add button opens the add sheet", async () => {
    await renderBar();
    expect(screen.queryByTestId("capture-sheet")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Tambah struk" }));
    expect(screen.getByTestId("capture-sheet")).toBeTruthy();
  });
});

describe("useTabBarSpace", () => {
  const Probe = () => <Text testID="space">{String(useTabBarSpace())}</Text>;
  const inTabs = <BottomTabBarHeightContext.Provider value={0}><Probe /></BottomTabBarHeightContext.Provider>;

  it("compact tab screens clear the bar: inset + 12 + capsule + 24", async () => {
    await render(inTabs);
    expect(screen.getByTestId("space")).toHaveTextContent(String(47 + 12 + light.size.capsule + 24));
  });

  it("is 0 on wide layouts and outside the tabs navigator", async () => {
    (useWindowClass as jest.Mock).mockReturnValueOnce("expanded");
    await render(inTabs);
    expect(screen.getByTestId("space")).toHaveTextContent("0");
    await render(<Probe />);
    expect(screen.getByTestId("space")).toHaveTextContent("0");
  });
});
