import { fireEvent, render, screen } from "@testing-library/react-native";

import { SlipEdge } from "./SlipEdge";

// The edge is decorative and hidden from screen readers, so queries must include hidden elements.
const hidden = { includeHiddenElements: true };

describe("SlipEdge", () => {
  it("renders ceil(width/10) teeth after layout", async () => {
    await render(<SlipEdge color="#F2F5F1" />);
    const edge = screen.getByTestId("slip-edge", hidden);
    expect(edge.children).toHaveLength(0);
    await fireEvent(edge, "layout", { nativeEvent: { layout: { width: 360, height: 10, x: 0, y: 0 } } });
    expect(screen.getByTestId("slip-edge", hidden).children).toHaveLength(36);
    await fireEvent(screen.getByTestId("slip-edge", hidden), "layout", { nativeEvent: { layout: { width: 365, height: 10, x: 0, y: 0 } } });
    expect(screen.getByTestId("slip-edge", hidden).children).toHaveLength(37);
  });

  it("teeth are 10 dp circles in the page colour and hidden from screen readers", async () => {
    await render(<SlipEdge color="#F2F5F1" />);
    const edge = screen.getByTestId("slip-edge", hidden);
    await fireEvent(edge, "layout", { nativeEvent: { layout: { width: 20, height: 10, x: 0, y: 0 } } });
    expect(screen.getByTestId("slip-edge", hidden).props.importantForAccessibility).toBe("no-hide-descendants");
    const tooth = screen.getAllByTestId("slip-tooth", hidden)[0];
    expect(tooth).toHaveStyle({ width: 10, height: 10, borderRadius: 5, backgroundColor: "#F2F5F1" });
  });
});
