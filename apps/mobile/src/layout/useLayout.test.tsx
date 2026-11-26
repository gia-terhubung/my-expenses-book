import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { layoutFor } from "./layout";
import { SideSafeArea } from "./SideSafeArea";
import { useLayout } from "./useLayout";

let mockDims = { width: 466, height: 678, scale: 2, fontScale: 1 };
let mockInsets = { top: 0, bottom: 0, left: 0, right: 84 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockDims,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => mockInsets,
}));
jest.mock("@/theme/ThemeProvider", () => ({
  useTheme: () => ({ colors: { background: "#F2F5F1" } }),
}));

function Probe() {
  return <Text testID="layout">{JSON.stringify(useLayout())}</Text>;
}
const parsed = () =>
  JSON.parse(screen.getByTestId("layout").props.children as string);

describe("useLayout", () => {
  it("reads the window and the safe-area side insets (closed Duo: content 382)", async () => {
    mockDims = { width: 466, height: 678, scale: 2, fontScale: 1 };
    mockInsets = { top: 0, bottom: 0, left: 0, right: 84 };
    await render(<Probe />);
    expect(parsed()).toEqual(
      layoutFor({ width: 466, height: 678, left: 0, right: 84 }),
    );
  });

  it("inside SideSafeArea uses the root side insets", async () => {
    mockDims = { width: 951, height: 669, scale: 2, fontScale: 1 };
    mockInsets = { top: 0, bottom: 0, left: 0, right: 84 };
    await render(
      <SideSafeArea>
        <Probe />
      </SideSafeArea>,
    );
    expect(parsed()).toMatchObject({ nav: "wideRail", listWidth: 280 });
  });
});
