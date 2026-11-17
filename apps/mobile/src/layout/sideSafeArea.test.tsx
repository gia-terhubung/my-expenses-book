import { readFileSync } from "fs";
import { join } from "path";

import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { SideSafeArea } from "./SideSafeArea";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 12, right: 84 }),
}));
jest.mock("@/theme/ThemeProvider", () => ({ useTheme: () => ({ colors: { background: "#F2F5F1" } }) }));

describe("SideSafeArea", () => {
  it("keeps content out of the side strips the device reserves (folded iPhone Duo: right 84)", async () => {
    await render(
      <SideSafeArea>
        <Text>body</Text>
      </SideSafeArea>,
    );
    const flat = Object.assign({}, ...[screen.getByTestId("side-safe-area").props.style].flat());
    expect(flat).toMatchObject({ flex: 1, paddingLeft: 12, paddingRight: 84, backgroundColor: "#F2F5F1" });
    // Top and bottom stay with the screens (status strip colour, floating tab bar lift).
    expect(flat.paddingTop).toBeUndefined();
    expect(flat.paddingBottom).toBeUndefined();
  });

  it("wraps the root stack, so every screen gets it", () => {
    const src = readFileSync(join(__dirname, "..", "app", "_layout.tsx"), "utf8");
    expect(src).toMatch(/<SideSafeArea>\s*<Stack /);
  });
});
