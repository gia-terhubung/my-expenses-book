import { render, screen } from "@testing-library/react-native";
import { useEffect } from "react";
import { Text, useWindowDimensions } from "react-native";

import { initI18n } from "@/i18n";

import { TwoPane } from "./TwoPane";

beforeAll(() => initI18n("en"));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockDims = useWindowDimensions as jest.Mock;
const setWidth = (width: number) => mockDims.mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });

const primary = <Text>list</Text>;
const secondary = <Text>detail</Text>;

describe("TwoPane", () => {
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
