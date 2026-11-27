import { readFileSync } from "fs";
import { join } from "path";

import { render, screen } from "@testing-library/react-native";
import { Platform, Text } from "react-native";

import { SideSafeArea, useSideInsets } from "./SideSafeArea";

function InsetsProbe() {
  return <Text testID="insets">{JSON.stringify(useSideInsets())}</Text>;
}

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 12, right: 84 }),
}));
jest.mock("@/theme/ThemeProvider", () => ({
  useTheme: () => ({ colors: { background: "#F2F5F1" } }),
}));

const rootStyle = () =>
  Object.assign({}, ...[screen.getByTestId("side-safe-area").props.style].flat());

describe("SideSafeArea", () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("ios: the root does not pad the sides, so native bars reach the iPhone Duo side column", async () => {
    Platform.OS = "ios";
    await render(
      <SideSafeArea>
        <Text>body</Text>
      </SideSafeArea>,
    );
    expect(rootStyle()).toMatchObject({
      flex: 1,
      paddingLeft: 0,
      paddingRight: 0,
      backgroundColor: "#F2F5F1",
    });
  });

  it("android: keeps content out of the side strips the device reserves (cutout held sideways)", async () => {
    Platform.OS = "android";
    await render(
      <SideSafeArea>
        <Text>body</Text>
      </SideSafeArea>,
    );
    const flat = rootStyle();
    expect(flat).toMatchObject({
      flex: 1,
      paddingLeft: 12,
      paddingRight: 84,
      backgroundColor: "#F2F5F1",
    });
    // Top and bottom stay with the screens (status strip colour, floating tab bar lift).
    expect(flat.paddingTop).toBeUndefined();
    expect(flat.paddingBottom).toBeUndefined();
  });

  it("publishes the root side insets to descendants (useSideInsets)", async () => {
    await render(
      <SideSafeArea>
        <InsetsProbe />
      </SideSafeArea>,
    );
    expect(screen.getByTestId("insets").props.children).toBe(
      '{"left":12,"right":84}',
    );
  });

  it("useSideInsets outside SideSafeArea falls back to the safe-area insets", async () => {
    await render(<InsetsProbe />);
    expect(screen.getByTestId("insets").props.children).toBe(
      '{"left":12,"right":84}',
    );
  });

  it("wraps the root stack, so every screen gets it", () => {
    const src = readFileSync(
      join(__dirname, "..", "app", "_layout.tsx"),
      "utf8",
    );
    expect(src).toMatch(/<SideSafeArea>\s*<AppStack \/>/);
  });
});
