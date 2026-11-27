import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { initI18n } from "@/i18n";

import { runAsAndroid } from "../../test/androidPlatform";

import { ScreenHeader } from "./ScreenHeader";

const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
const mockScreenOptions = jest.fn();
jest.mock("expo-router", () => {
  const { Stack } = jest.requireActual("../../test/expoRouterStack").stackMock;
  return {
    // ScreenHeader uses Stack.Screen and Stack.Toolbar only; record the native header options.
    Stack: {
      Toolbar: Stack.Toolbar,
      Screen: ({ options }: { options: object }) => {
        mockScreenOptions(options);
        return null;
      },
    },
    router: {
    back: () => mockRouter.back(),
    replace: (...a: unknown[]) => mockRouter.replace(...a),
    canGoBack: () => mockRouter.canGoBack(),
    },
  };
});

function flat(node: { props: { style?: unknown } }) {
  const s = node.props.style;
  return StyleSheet.flatten(typeof s === "function" ? s({ pressed: false }) : (s as object));
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockRouter.back.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.canGoBack.mockReturnValue(true);
  mockScreenOptions.mockClear();
});

describe("ScreenHeader (Android: in-page header)", () => {
  runAsAndroid();

  it("back has label 'Back', 48dp, and calls onBack", async () => {
    const onBack = jest.fn();
    await render(<ScreenHeader title="Categories" onBack={onBack} />);
    const back = screen.getByRole("button", { name: "Back" });
    expect(flat(back).width).toBe(48);
    expect(flat(back).height).toBe(48);
    await fireEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("goes back by default", async () => {
    await render(<ScreenHeader title="Categories" />);
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("falls back to router.replace('/') when it can't go back", async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    await render(<ScreenHeader title="Categories" />);
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it("onBack={null} shows the title without a back button (second pane)", async () => {
    await render(<ScreenHeader title="Edit recurring expense" onBack={null} />);
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(screen.getByRole("header", { name: "Edit recurring expense" })).toBeTruthy();
  });

  it("title is a header", async () => {
    await render(<ScreenHeader title="Categories" />);
    expect(screen.getByRole("header", { name: "Categories" })).toBeTruthy();
  });

  it("renders actions at the end of the row", async () => {
    const { Text } = jest.requireActual("react-native");
    await render(<ScreenHeader title="Recurring" actions={<Text>New</Text>} />);
    expect(screen.getByText("New")).toBeTruthy();
  });
});

describe("ScreenHeader (iOS: native stack header)", () => {
  const { Text } = jest.requireActual("react-native");

  it("hands the title to the native header and draws no in-page Back", async () => {
    await render(<ScreenHeader title="Categories" />);
    expect(mockScreenOptions).toHaveBeenLastCalledWith({ headerShown: true, title: "Categories" });
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(screen.queryByRole("header", { name: "Categories" })).toBeNull();
  });

  it("puts the page's toolbar items in the native header", async () => {
    const { stackMock } = jest.requireActual("../../test/expoRouterStack");
    const onNew = jest.fn();
    await render(
      <ScreenHeader
        title="Recurring"
        toolbar={<stackMock.Stack.Toolbar.Button accessibilityLabel="New" onPress={onNew} />}
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "New" }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("onBack={null} (second pane) keeps the in-page title, no native header", async () => {
    await render(<ScreenHeader title="Edit recurring expense" onBack={null} actions={<Text>Save</Text>} />);
    expect(mockScreenOptions).not.toHaveBeenCalled();
    expect(screen.getByRole("header", { name: "Edit recurring expense" })).toBeTruthy();
    expect(screen.getByText("Save")).toBeTruthy();
  });
});
