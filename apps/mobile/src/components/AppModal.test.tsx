import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { AppObscuredContext } from "@/lock/appObscured";

import { AppModal } from "./AppModal";

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
});
