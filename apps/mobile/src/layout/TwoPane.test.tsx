import { render, screen } from "@testing-library/react-native";
import { Text, useWindowDimensions } from "react-native";

import { TwoPane } from "./TwoPane";

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
  });
});
