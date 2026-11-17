import { render, screen, within } from "@testing-library/react-native";
import { Text } from "react-native";

import { AppObscuredContext } from "@/lock/appObscured";

import { AppModal } from "./AppModal";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 84 }),
}));

function ui(obscured: boolean, onRequestClose = jest.fn()) {
  return (
    <AppObscuredContext.Provider value={obscured}>
      <AppModal visible onRequestClose={onRequestClose}>
        <Text>sheet</Text>
      </AppModal>
    </AppObscuredContext.Provider>
  );
}

describe("AppModal", () => {
  it("shows when not obscured, and outside any provider", async () => {
    await render(ui(false));
    expect(screen.getByText("sheet")).toBeTruthy();
  });
  it("shows outside the provider", async () => {
    await render(
      <AppModal visible>
        <Text>sheet</Text>
      </AppModal>,
    );
    expect(screen.getByText("sheet")).toBeTruthy();
  });
  it("hides and requests close when obscured (locked or privacy-covered)", async () => {
    const close = jest.fn();
    await render(ui(true, close));
    expect(screen.queryByText("sheet")).toBeNull();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("a page-sheet modal's content sits inside modal-side-inset", async () => {
    await render(
      <AppModal visible presentationStyle="pageSheet">
        <Text>x</Text>
      </AppModal>,
    );
    expect(within(screen.getByTestId("modal-side-inset")).getByText("x")).toBeTruthy();
  });

  it("transparent modals and sideInset={false} are not wrapped", async () => {
    const view = await render(
      <AppModal visible transparent>
        <Text>x</Text>
      </AppModal>,
    );
    expect(screen.queryByTestId("modal-side-inset")).toBeNull();
    expect(screen.getByText("x")).toBeTruthy();
    await view.unmount();
    await render(
      <AppModal visible sideInset={false}>
        <Text>y</Text>
      </AppModal>,
    );
    expect(screen.queryByTestId("modal-side-inset")).toBeNull();
    expect(screen.getByText("y")).toBeTruthy();
  });
});
