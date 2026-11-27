import { render, screen } from "@testing-library/react-native";
import { Platform, StyleSheet, Text } from "react-native";

import ModalsLayout from "@/app/(modals)/_layout";
import { ModalSideInset } from "./ModalSideInset";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 12, right: 84 }),
}));
jest.mock("@/theme/ThemeProvider", () => ({
  useTheme: () => ({ colors: { background: "#F2F5F1" } }),
}));

describe("ModalSideInset", () => {
  it("pads modal content by the root side insets with the page background", async () => {
    await render(
      <ModalSideInset>
        <Text>body</Text>
      </ModalSideInset>,
    );
    const flat = StyleSheet.flatten(
      screen.getByTestId("modal-side-inset").props.style,
    );
    expect(flat).toMatchObject({
      flex: 1,
      paddingLeft: 12,
      paddingRight: 84,
      backgroundColor: "#F2F5F1",
    });
    expect(flat.paddingTop).toBeUndefined();
  });
});

type MockOptions = { contentStyle?: object; headerShown?: boolean; presentation?: string };
let mockStackProps: {
  screenOptions?: MockOptions | ((a: { route: { name: string } }) => MockOptions);
  children?: unknown;
} = {};
const optionsFor = (name: string) => {
  const o = mockStackProps.screenOptions;
  return typeof o === "function" ? o({ route: { name } }) : o;
};
jest.mock("expo-router", () => {
  const mockRn = jest.requireActual("react-native");
  return {
    Stack: (props: typeof mockStackProps) => {
      mockStackProps = props;
      return <mockRn.View testID="modals-stack" />;
    },
  };
});
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

describe("(modals) layout", () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
    mockStackProps = {};
  });

  it("ios: each modal screen pads its content by the side insets (native headers stay full width)", async () => {
    Platform.OS = "ios";
    await render(<ModalsLayout />);
    expect(screen.queryByTestId("modal-side-inset")).toBeNull();
    expect(screen.getByTestId("modals-stack")).toBeTruthy();
    expect(optionsFor("review/[id]")?.contentStyle).toMatchObject({
      paddingLeft: 12,
      paddingRight: 84,
    });
  });

  it("ios: the picker is a native sheet set through screenOptions, with no declared screens (route order stays fixed)", async () => {
    Platform.OS = "ios";
    await render(<ModalsLayout />);
    expect(mockStackProps.children).toBeUndefined();
    expect(optionsFor("picker")).toMatchObject({ presentation: "modal", headerShown: true });
    expect(optionsFor("export")?.presentation).toBeUndefined();
  });

  it("android: no wrapper and no padding (the root SideSafeArea already insets the native modal)", async () => {
    Platform.OS = "android";
    await render(<ModalsLayout />);
    expect(screen.queryByTestId("modal-side-inset")).toBeNull();
    expect(optionsFor("review/[id]")).toEqual({ headerShown: false });
  });
});
