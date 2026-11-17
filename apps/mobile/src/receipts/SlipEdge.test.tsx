import { render, screen } from "@testing-library/react-native";

import { SlipEdge } from "./SlipEdge";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 951, height: 669, scale: 3, fontScale: 1 }),
}));

// The edge is decorative and hidden from screen readers, so queries must include hidden elements.
const hidden = { includeHiddenElements: true };

describe("SlipEdge", () => {
  it("covers the full window width without measuring (onLayout is not re-sent after a rotation)", async () => {
    await render(<SlipEdge color="#F2F5F1" />);
    expect(screen.getByTestId("slip-edge", hidden).children).toHaveLength(96);
  });

  it("teeth are 10 dp circles in the page colour and hidden from screen readers", async () => {
    await render(<SlipEdge color="#F2F5F1" />);
    expect(screen.getByTestId("slip-edge", hidden).props.importantForAccessibility).toBe("no-hide-descendants");
    const tooth = screen.getAllByTestId("slip-tooth", hidden)[0];
    expect(tooth).toHaveStyle({ width: 10, height: 10, borderRadius: 5, backgroundColor: "#F2F5F1" });
  });
});
