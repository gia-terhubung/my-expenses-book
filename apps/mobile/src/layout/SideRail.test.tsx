import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { StyleSheet } from "react-native";

import { AddReceiptProvider } from "@/capture/AddReceiptProvider";
import { initI18n } from "@/i18n";
import { LAYOUTS } from "@/layout/testing/layouts";
import { tokens } from "@/theme/tokens";

import { SideRail, type RailVariant } from "./SideRail";

let mockLayout: (typeof LAYOUTS)[keyof typeof LAYOUTS] = LAYOUTS.phone;
jest.mock("@/layout/useLayout", () => ({ useLayout: () => mockLayout }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));
// The add sheet's capture flow reads the DB and prefs; the real providers need native modules.
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => null }));
jest.mock("@/prefs/PrefsProvider", () => ({ usePref: () => "IDR" }));

const light = tokens.light;
const ROUTES = ["(receipts)", "search", "folders", "settings"];

const props = (index = 0) =>
  ({
    state: {
      index,
      routes: ROUTES.map((name) => ({ key: `${name}-key`, name })),
    },
    navigateToTab: jest.fn(),
  }) as unknown as BottomTabBarProps;

function flat(node: { props: { style?: unknown } }) {
  const s = node.props.style;
  return StyleSheet.flatten(
    typeof s === "function" ? s({ pressed: false }) : (s as object),
  );
}

const renderRail = (variant: RailVariant, index = 0) =>
  render(
    <AddReceiptProvider>
      <SideRail {...props(index)} variant={variant} />
    </AddReceiptProvider>,
  );

beforeAll(() => initI18n("id"));
beforeEach(() => {
  mockLayout = LAYOUTS.phone;
});

describe("SideRail", () => {
  it.each([
    ["icons", 72],
    ["labels", 200],
  ] as const)(
    "%s rail is %i wide, hairline end border, top padding 32",
    async (variant, width) => {
      await renderRail(variant);
      expect(flat(screen.getByTestId("side-rail"))).toMatchObject({
        width,
        borderEndWidth: StyleSheet.hairlineWidth,
        paddingTop: 32,
        paddingBottom: 34 + 16,
      });
    },
  );

  it("icons: each tab is icon over a caption label, 56 high, 8 side margin, a11y name = label", async () => {
    await renderRail("icons");
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.props.accessibilityLabel)).toEqual([
      "Struk",
      "Cari",
      "Folder",
      "Pengaturan",
    ]);
    expect(flat(tabs[0])).toMatchObject({
      minHeight: 56,
      marginHorizontal: 8,
      backgroundColor: light.colors.tonal,
    });
    const icon = tabs[0].children[0] as { props: Record<string, unknown> };
    // Ionicons renders its size and colour as text style.
    expect(icon.props.accessible).toBe(false);
    expect(flat(icon as never)).toMatchObject({
      fontSize: 22,
      color: light.colors.primary,
    });
    expect(flat(tabs[1].children[0] as never).color).toBe(
      light.colors.textMuted,
    );
  });

  it("icons: labels shrink, never wrap (Pengaturan at 1.3x)", async () => {
    await renderRail("icons");
    expect(screen.getByText("Pengaturan").props).toMatchObject({
      numberOfLines: 1,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.75,
      maxFontSizeMultiplier: 1.3,
    });
    expect(flat(screen.getByText("Pengaturan"))).toMatchObject({
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "600",
    });
  });

  it("labels: icon before the label, 16 side margin kept", async () => {
    await renderRail("labels");
    const tab = screen.getAllByRole("tab")[0];
    expect(flat(tab)).toMatchObject({
      marginHorizontal: 16,
      flexDirection: "row",
    });
    expect(flat(tab.children[0] as never).fontSize).toBe(22);
  });

  it("labels: each tab meets the 48 dp touch target", async () => {
    await renderRail("labels");
    for (const tab of screen.getAllByRole("tab"))
      expect(flat(tab).minHeight).toBeGreaterThanOrEqual(48);
  });

  it("the tabs scroll and the + sits outside the scroll container, pinned at the bottom", async () => {
    await renderRail("icons");
    const scroll = screen.getByTestId("rail-scroll");
    expect(within(scroll).getAllByRole("tab")).toHaveLength(4);
    expect(within(scroll).queryByTestId("rail-add")).toBeNull();
    expect(
      within(screen.getByTestId("side-rail")).getByTestId("rail-add"),
    ).toBeTruthy();
  });

  it("short window (phone landscape, ~360 high): all four tabs fit above the + (48 dp tabs, tight gaps)", async () => {
    mockLayout = LAYOUTS.duoSideways;
    expect(mockLayout.short).toBe(true);
    await renderRail("icons");
    const rail = flat(screen.getByTestId("side-rail"));
    expect(rail.paddingTop).toBe(8);
    expect(rail.paddingBottom).toBe(34 + 8);
    const tabs = screen.getAllByRole("tab");
    expect(flat(tabs[0]).minHeight).toBe(48);
    expect(
      StyleSheet.flatten(
        screen.getByTestId("rail-scroll").props.contentContainerStyle,
      ).gap,
    ).toBe(4);
    // 8 + 4 x 48 + 3 x 4 + (8 + 56) + 8 = 284, plus the bottom inset: fits a 360 dp landscape phone.
  });

  it.each(["icons", "labels"] as const)(
    "%s: round + (56) labelled Tambah struk opens the add sheet",
    async (variant) => {
      await renderRail(variant);
      const add = screen.getByTestId("rail-add");
      expect(add.props.accessibilityLabel).toBe("Tambah struk");
      expect(flat(add)).toMatchObject({
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: light.colors.primary,
      });
      await fireEvent.press(add);
      expect(screen.getByTestId("capture-sheet")).toBeTruthy();
    },
  );
});
