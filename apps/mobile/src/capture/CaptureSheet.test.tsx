import { render, screen } from "@testing-library/react-native";
import { StyleSheet, useWindowDimensions } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { tokens } from "@/theme/tokens";

import { CaptureSheet } from "./CaptureSheet";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn(),
}));
const setDims = (width: number, height: number) =>
  (useWindowDimensions as jest.Mock).mockReturnValue({ width, height, scale: 2, fontScale: 1 });

const light = tokens.light;
const renderSheet = (width = 360, height = 800, right = 0) => {
  setDims(width, height);
  const metrics = { frame: { x: 0, y: 0, width, height }, insets: { top: 0, left: 0, right, bottom: 0 } };
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <CaptureSheet visible onClose={() => {}} onChoose={() => {}} />
    </SafeAreaProvider>,
  );
};

function flat(node: { props: { style?: unknown } }) {
  const s = node.props.style;
  return StyleSheet.flatten(typeof s === "function" ? s({ pressed: false }) : (s as object));
}

describe("CaptureSheet", () => {
  it("scan option is the primary (filled) choice", async () => {
    await renderSheet();
    const scan = screen.getByRole("button", { name: "capture.scan" });
    expect(flat(scan).backgroundColor).toBe(light.colors.primary);
    expect(flat(screen.getByText("capture.scan")).color).toBe(light.colors.onPrimary);
    const photos = screen.getByRole("button", { name: "capture.import" });
    expect(flat(photos).backgroundColor).toBe(light.colors.tonal);
    expect(flat(photos).borderRadius).toBe(light.radius.control);
  });

  it("sheet has the sheet elevation", async () => {
    await renderSheet();
    const sheet = flat(screen.getByTestId("capture-sheet"));
    expect(sheet.boxShadow).toBe(light.elevation.sheet);
    expect(sheet.borderTopLeftRadius).toBe(light.radius.sheet);
    expect(flat(screen.getByTestId("capture-grab-handle"))).toMatchObject({ width: 40, height: 4 });
  });

  it("closed Duo (466 wide, right 84): full-width sheet kept out of the status strip", async () => {
    await renderSheet(466, 678, 84);
    expect(flat(screen.getByTestId("capture-sheet-frame"))).toMatchObject({ paddingLeft: 0, paddingRight: 84 });
    expect(flat(screen.getByTestId("capture-sheet"))).toMatchObject({ width: "100%", maxWidth: "100%", alignSelf: "center" });
  });

  it("open landscape (951 wide, right 84): a centred 480 card", async () => {
    await renderSheet(951, 669, 84);
    expect(flat(screen.getByTestId("capture-sheet-frame"))).toMatchObject({ paddingRight: 84 });
    expect(flat(screen.getByTestId("capture-sheet"))).toMatchObject({
      width: "100%",
      maxWidth: 480,
      alignSelf: "center",
      borderTopLeftRadius: light.radius.sheet,
    });
  });

  it("599 content stays full width; 600 becomes the card", async () => {
    const view = await renderSheet(599, 800);
    expect(flat(screen.getByTestId("capture-sheet")).maxWidth).toBe("100%");
    await view.unmount();
    await renderSheet(600, 800);
    expect(flat(screen.getByTestId("capture-sheet")).maxWidth).toBe(480);
  });
});
