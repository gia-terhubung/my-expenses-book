import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { initI18n } from "@/i18n";

import { ZoomableImage } from "./ZoomableImage";

beforeAll(() => initI18n("en"));

const size = { width: 1000, height: 3000 };

async function mount() {
  await render(<ZoomableImage uri="file:///cache/view/a.jpg" contentSize={size} />);
  const surface = screen.getByTestId("zoom-surface");
  await act(async () => {
    fireEvent(surface, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } } });
  });
  return surface;
}

describe("ZoomableImage", () => {
  it("draws the photo contain-fitted", async () => {
    await mount();
    expect(screen.getByTestId("zoom-image").props.contentFit).toBe("contain");
  });

  it("offers translated zoom in / zoom out actions to screen readers", async () => {
    const surface = await mount();
    expect(surface.props.accessibilityActions).toEqual([
      { name: "zoomIn", label: "Zoom in" },
      { name: "zoomOut", label: "Zoom out" },
    ]);
  });

  it("starts at 100% and steps by 1.5x, clamped to 1x..5x", async () => {
    const surface = await mount();
    expect(surface.props.accessibilityValue).toEqual({ text: "100%" });
    await act(async () => fireEvent(surface, "accessibilityAction", { nativeEvent: { actionName: "zoomIn" } }));
    expect(screen.getByTestId("zoom-surface").props.accessibilityValue).toEqual({ text: "150%" });
    for (let i = 0; i < 6; i++) {
      await act(async () => fireEvent(screen.getByTestId("zoom-surface"), "accessibilityAction", { nativeEvent: { actionName: "zoomIn" } }));
    }
    expect(screen.getByTestId("zoom-surface").props.accessibilityValue).toEqual({ text: "500%" });
    for (let i = 0; i < 8; i++) {
      await act(async () => fireEvent(screen.getByTestId("zoom-surface"), "accessibilityAction", { nativeEvent: { actionName: "zoomOut" } }));
    }
    expect(screen.getByTestId("zoom-surface").props.accessibilityValue).toEqual({ text: "100%" });
  });

  it("resets the zoom when the viewport size changes (fold, unfold, rotate)", async () => {
    const surface = await mount();
    await act(async () => fireEvent(surface, "accessibilityAction", { nativeEvent: { actionName: "zoomIn" } }));
    await act(async () => {
      fireEvent(screen.getByTestId("zoom-surface"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 800, height: 400 } } });
    });
    expect(screen.getByTestId("zoom-surface").props.accessibilityValue).toEqual({ text: "100%" });
  });
});
