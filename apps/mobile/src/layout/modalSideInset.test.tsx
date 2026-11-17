
import { render, screen } from "@testing-library/react-native";
import { Platform, StyleSheet, Text } from "react-native";

import ModalsLayout from "@/app/(modals)/_layout";
import { ModalSideInset } from "./ModalSideInset";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 12, right: 84 }),
}));
jest.mock("@/theme/ThemeProvider", () => ({ useTheme: () => ({ colors: { background: "#F2F5F1" } }) }));

describe("ModalSideInset", () => {
  it("pads modal content by the root side insets with the page background", async () => {
    await render(
      <ModalSideInset>
        <Text>body</Text>
      </ModalSideInset>,
    );
    const flat = StyleSheet.flatten(screen.getByTestId("modal-side-inset").props.style);
    expect(flat).toMatchObject({ flex: 1, paddingLeft: 12, paddingRight: 84, backgroundColor: "#F2F5F1" });
    expect(flat.paddingTop).toBeUndefined();
  });
});

jest.mock("expo-router", () => {
  const mockRn = jest.requireActual("react-native");
  return { Stack: () => <mockRn.View testID="modals-stack" /> };
});

describe("(modals) layout", () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it("ios: the stack sits inside ModalSideInset", async () => {
    Platform.OS = "ios";
    await render(<ModalsLayout />);
    expect(screen.getByTestId("modal-side-inset")).toBeTruthy();
    expect(screen.getByTestId("modals-stack")).toBeTruthy();
  });

  it("android: no wrapper (the root SideSafeArea already insets the native modal)", async () => {
    Platform.OS = "android";
    await render(<ModalsLayout />);
    expect(screen.queryByTestId("modal-side-inset")).toBeNull();
    expect(screen.getByTestId("modals-stack")).toBeTruthy();
  });
});
