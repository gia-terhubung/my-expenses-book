import { render } from "@testing-library/react-native";
import { setStatusBarStyle } from "expo-status-bar";

import PhotoRoute from "@/app/(tabs)/(receipts,search,folders,settings)/photo";

/** The full-screen photo is black: the status icons (the Duo's side column too) must be light. */
jest.mock("expo-status-bar", () => ({ setStatusBarStyle: jest.fn() }));
jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual("react");
  return {
    ...jest.requireActual("../../test/expoRouterStack").stackMock,
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});

it("light status icons while the photo is open, themed again when it closes", async () => {
  const view = await render(<PhotoRoute />);
  expect(setStatusBarStyle).toHaveBeenLastCalledWith("light");
  await view.unmount();
  expect(setStatusBarStyle).toHaveBeenLastCalledWith("dark");
});
