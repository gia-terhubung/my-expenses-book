import { fireEvent, render, screen } from "@testing-library/react-native";

import { initI18n } from "@/i18n";

import { FeedEmpty } from "./FeedEmpty";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

beforeAll(() => initI18n("en"));

describe("FeedEmpty", () => {
  it("offers scan and manual entry as next actions", async () => {
    const onStart = jest.fn();
    await render(<FeedEmpty onStart={onStart} />);
    expect(screen.getByText("No receipts yet. Scanned receipts will show up here.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Scan a receipt" }));
    expect(onStart).toHaveBeenLastCalledWith("scan");
    await fireEvent.press(screen.getByRole("button", { name: "Add manually" }));
    expect(onStart).toHaveBeenLastCalledWith("manual");
  });
});
