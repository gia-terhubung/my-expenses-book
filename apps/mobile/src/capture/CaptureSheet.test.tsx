import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { tokens } from "@/theme/tokens";

import { CaptureSheet } from "./CaptureSheet";

const light = tokens.light;
const metrics = { frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const renderSheet = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <CaptureSheet visible onClose={() => {}} onChoose={() => {}} />
    </SafeAreaProvider>,
  );

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
});
