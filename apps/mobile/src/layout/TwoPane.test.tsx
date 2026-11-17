import { render, screen } from "@testing-library/react-native";
import { useEffect } from "react";
import { StyleSheet, Text, useWindowDimensions } from "react-native";

import { initI18n } from "@/i18n";
import { tokens } from "@/theme/tokens";

import { TwoPane } from "./TwoPane";

beforeAll(() => initI18n("en"));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => mockInsets }));

const mockDims = useWindowDimensions as jest.Mock;
const setDims = (width: number, height: number) => mockDims.mockReturnValue({ width, height, scale: 2, fontScale: 1 });
const setWidth = (width: number) => setDims(width, 800);
const flatOf = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

beforeEach(() => {
  Object.assign(mockInsets, { top: 0, bottom: 0, left: 0, right: 0 });
});

const primary = <Text>list</Text>;
const secondary = <Text>detail</Text>;

describe("TwoPane", () => {
  it("open landscape (951 x 669, right 84): list pane is exactly 280 wide by width (not flexBasis: RN 0.88 ignores a runtime flexBasis change, F1)", async () => {
    setDims(951, 669);
    mockInsets.right = 84;
    await render(<TwoPane primary={primary} secondary={secondary} />);
    const s = flatOf("pane-primary");
    expect(s).toMatchObject({ flexGrow: 0, flexShrink: 0, flexBasis: "auto", width: 280, borderEndWidth: StyleSheet.hairlineWidth });
    expect(s.flex).toBeUndefined();
    expect(s.maxWidth).toBeUndefined();
  });

  it("not split: list pane carries the same keys with single-pane values", async () => {
    setDims(669, 951);
    const view = await render(<TwoPane primary={primary} secondary={null} />);
    const single = flatOf("pane-primary");
    expect(single).toMatchObject({ flexGrow: 0, flexShrink: 0, flexBasis: "auto", width: "100%", borderEndWidth: 0 });
    await view.unmount();
    setDims(951, 669);
    mockInsets.right = 84;
    await render(<TwoPane primary={primary} secondary={null} />);
    expect(Object.keys(flatOf("pane-primary")).sort()).toEqual(Object.keys(single).sort());
  });

  it("detail pane is always { flexGrow 1, flexShrink 1, flexBasis 0, minWidth 0 }", async () => {
    for (const [w, h] of [
      [951, 669],
      [400, 800],
    ]) {
      setDims(w, h);
      const view = await render(<TwoPane primary={primary} secondary={secondary} />);
      expect(flatOf("pane-secondary")).toMatchObject({ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 });
      await view.unmount();
    }
  });

  it("open portrait (669 x 951): one pane; a selection replaces the list", async () => {
    setDims(669, 951);
    await render(<TwoPane primary={primary} secondary={secondary} />);
    expect(screen.queryByTestId("pane-primary")).toBeNull();
    expect(screen.getByText("detail")).toBeTruthy();
    expect(screen.queryByTestId("pane-placeholder")).toBeNull();
  });

  it.each([
    [1024, 346],
    [1600, 420],
  ])("width %i: list %i", async (w, list) => {
    setWidth(w);
    await render(<TwoPane primary={primary} secondary={secondary} />);
    expect(flatOf("pane-primary").width).toBe(list);
  });

  it("compact: shows only secondary when given", async () => {
    setWidth(400);
    await render(<TwoPane primary={primary} secondary={secondary} />);
    expect(screen.queryByTestId("pane-primary")).toBeNull();
    expect(screen.getByTestId("pane-secondary")).toBeTruthy();
    expect(screen.getByText("detail")).toBeTruthy();
  });

  it("compact: shows primary when no secondary", async () => {
    setWidth(400);
    await render(<TwoPane primary={primary} secondary={null} />);
    expect(screen.getByTestId("pane-primary")).toBeTruthy();
    expect(screen.queryByTestId("pane-secondary")).toBeNull();
  });

  it("expanded: shows both", async () => {
    setWidth(900);
    await render(<TwoPane primary={primary} secondary={secondary} />);
    expect(screen.getByTestId("pane-primary")).toBeTruthy();
    expect(screen.getByTestId("pane-secondary")).toBeTruthy();
  });

  it("medium: empty secondary shows placeholder slot", async () => {
    setWidth(700);
    await render(<TwoPane primary={primary} secondary={null} />);
    expect(screen.getByTestId("pane-primary")).toBeTruthy();
    expect(screen.getByTestId("pane-secondary")).toBeTruthy();
    expect(screen.getByTestId("pane-placeholder")).toBeTruthy();
    expect(screen.getByText("Receipt details will appear here.")).toBeTruthy();
  });

  it("placeholder pane uses the theme background (not white in dark mode)", async () => {
    setWidth(700);
    await render(<TwoPane primary={primary} secondary={null} />);
    const style = StyleSheet.flatten(screen.getByTestId("pane-placeholder").props.style);
    expect(style.backgroundColor).toBe(tokens.light.colors.background);
  });

  it("compact: the hidden pane is kept mounted but hidden from accessibility", async () => {
    setWidth(400);
    await render(<TwoPane primary={primary} secondary={secondary} />);
    const hidden = screen.getByTestId("pane-primary", { includeHiddenElements: true });
    expect(hidden.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ display: "none" })]));
    expect(hidden.props.accessibilityElementsHidden).toBe(true);
    expect(hidden.props.importantForAccessibility).toBe("no-hide-descendants");
    expect(screen.getByText("list", { includeHiddenElements: true })).toBeTruthy();
  });

  it("panes are not remounted across window-class changes", async () => {
    const mounts = { list: 0, detail: 0 };
    function Probe({ name }: { name: "list" | "detail" }) {
      useEffect(() => {
        mounts[name] += 1;
      }, [name]);
      return <Text>{name}</Text>;
    }
    const ui = (withDetail: boolean) => (
      <TwoPane primary={<Probe name="list" />} secondary={withDetail ? <Probe name="detail" /> : null} />
    );
    setWidth(900);
    const view = await render(ui(true));
    setWidth(400);
    await view.rerender(ui(true));
    setWidth(700);
    await view.rerender(ui(true));
    setWidth(400);
    await view.rerender(ui(false));
    setWidth(900);
    await view.rerender(ui(false));
    expect(mounts).toEqual({ list: 1, detail: 1 });
  });
});
