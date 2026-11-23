import { fireEvent, render, screen, within } from "@testing-library/react-native";

import { initI18n } from "@/i18n";

import { TourCards } from "./TourCards";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

beforeAll(() => initI18n("en"));

const ui = (onDone = jest.fn(), onBackFromFirst = jest.fn(), onClose?: () => void) => (
  <TourCards mode="column" onDone={onDone} onBackFromFirst={onBackFromFirst} onClose={onClose} />
);

describe("TourCards", () => {
  it("Next steps through 3 cards then finishes", async () => {
    const onDone = jest.fn();
    await render(ui(onDone));
    expect(screen.getByRole("header", { name: "Add receipts" })).toBeTruthy();
    expect(screen.getByLabelText("Step 1 of 3")).toBeTruthy();
    await fireEvent.press(screen.getByText("Next"));
    expect(screen.getByRole("header", { name: "Check and save" })).toBeTruthy();
    await fireEvent.press(screen.getByText("Next"));
    expect(screen.getByRole("header", { name: "See your totals" })).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Start using the app"));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("Skip finishes from card 1", async () => {
    const onDone = jest.fn();
    await render(ui(onDone));
    await fireEvent.press(screen.getByRole("button", { name: "Skip" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("Back on card 1 calls onBackFromFirst; on card 2 it goes to card 1", async () => {
    const onBack = jest.fn();
    await render(ui(jest.fn(), onBack));
    await fireEvent.press(screen.getByText("Next"));
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("header", { name: "Add receipts" })).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("illustrations are hidden from screen readers", async () => {
    await render(ui());
    for (let i = 0; i < 3; i++) {
      const art = screen.getByTestId(/^guide-illustration-/, { includeHiddenElements: true });
      expect(art.props.importantForAccessibility).toBe("no-hide-descendants");
      expect(art.props.accessibilityElementsHidden).toBe(true);
      expect(within(art).queryAllByRole("button")).toHaveLength(0);
      if (i < 2) await fireEvent.press(screen.getByText("Next"));
    }
  });

  it("shows Close only when onClose is given (replay)", async () => {
    const onClose = jest.fn();
    await render(ui(jest.fn(), jest.fn(), onClose));
    await fireEvent.press(screen.getByRole("button", { name: "Close guide" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
