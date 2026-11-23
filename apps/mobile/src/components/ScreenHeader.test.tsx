import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { initI18n } from "@/i18n";

import { ScreenHeader } from "./ScreenHeader";

const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock("expo-router", () => ({
  router: {
    back: () => mockRouter.back(),
    replace: (...a: unknown[]) => mockRouter.replace(...a),
    canGoBack: () => mockRouter.canGoBack(),
  },
}));

function flat(node: { props: { style?: unknown } }) {
  const s = node.props.style;
  return StyleSheet.flatten(typeof s === "function" ? s({ pressed: false }) : (s as object));
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockRouter.back.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.canGoBack.mockReturnValue(true);
});

describe("ScreenHeader", () => {
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
