import { act, render } from "@testing-library/react-native";
import { useEffect } from "react";
import { Text } from "react-native";

import { NativeTabsContext } from "./navContext";
import { TabScreen } from "./TabPlus";

/** iOS Home (bleed): folding or rotating changes split; the screen under it must not remount. */
jest.mock("expo-router", () => jest.requireActual("../../test/expoRouterStack").stackMock);
jest.mock("expo-status-bar", () => ({ useVerticalBarEdgeIOS: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 84 }),
}));
jest.mock("./FloatingAddButton", () => ({ FloatingAddButton: () => null }));
let mockSplit = false;
const mockSubs = new Set<() => void>();
jest.mock("./useLayout", () => ({
  useLayout: () => {
    const { useSyncExternalStore } = jest.requireActual("react");
    const split = useSyncExternalStore(
      (fn: () => void) => (mockSubs.add(fn), () => mockSubs.delete(fn)),
      () => mockSplit,
    );
    return { split };
  },
}));

let mounts = 0;
function Screen() {
  useEffect(() => {
    mounts += 1;
  }, []);
  return <Text>home</Text>;
}

it("Home keeps its screen mounted when split changes (fold, unfold, rotate)", async () => {
  mounts = 0;
  mockSplit = false;
  await render(
    <NativeTabsContext.Provider value>
      <TabScreen home bleed>
        <Screen />
      </TabScreen>
    </NativeTabsContext.Provider>,
  );
  await act(async () => {
    mockSplit = true;
    mockSubs.forEach((fn) => fn());
  });
  await act(async () => {
    mockSplit = false;
    mockSubs.forEach((fn) => fn());
  });
  expect(mounts).toBe(1);
});
