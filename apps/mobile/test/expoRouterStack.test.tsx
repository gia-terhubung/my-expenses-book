import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { stackMock } from "./expoRouterStack";

const { Stack } = stackMock;

describe("stackMock", () => {
  it("toolbar buttons are pressable by their accessible name", async () => {
    const fn = jest.fn();
    await render(
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button accessibilityLabel="Export" onPress={fn} />
      </Stack.Toolbar>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Export" }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("a button without a label is named by its text child", async () => {
    const fn = jest.fn();
    await render(
      <Stack.Toolbar>
        <Stack.Toolbar.Button onPress={fn}>New</Stack.Toolbar.Button>
      </Stack.Toolbar>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "New" }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("menus render their actions; Screen and Spacer render nothing", async () => {
    const fn = jest.fn();
    await render(
      <>
        <Stack.Screen options={{ title: "X" }} />
        <Stack.Toolbar>
          <Stack.Toolbar.Spacer />
          <Stack.Toolbar.Menu accessibilityLabel="More" icon="ellipsis.circle">
            <Stack.Toolbar.MenuAction onPress={fn}>Add receipt</Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.View>
            <Text>custom</Text>
          </Stack.Toolbar.View>
        </Stack.Toolbar>
      </>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Add receipt" }));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(screen.getByText("custom")).toBeTruthy();
    expect(screen.getByLabelText("More")).toBeTruthy();
  });
});
