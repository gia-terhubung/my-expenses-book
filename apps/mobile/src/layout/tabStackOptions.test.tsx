import { render } from "@testing-library/react-native";
import { Platform } from "react-native";

import { initI18n } from "@/i18n";

import TabStack from "@/app/(tabs)/(receipts,search,folders,settings)/_layout";

/** The tab stack's per-route options (a function of the route), by platform. */
type Options = { contentStyle?: { paddingLeft?: number; paddingRight?: number }; headerShown?: boolean; presentation?: string };
let screenOptions: (a: { route: { name: string } }) => Options;
jest.mock("expo-router", () => {
  const { stackMock } = jest.requireActual("../../test/expoRouterStack");
  const Stack = Object.assign((p: { screenOptions: typeof screenOptions }) => {
    screenOptions = p.screenOptions;
    return null;
  }, stackMock.Stack);
  return { Stack };
});
jest.mock("expo-status-bar", () => ({ useVerticalBarEdgeIOS: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 40, right: 40 }),
}));

const originalOS = Platform.OS;
beforeAll(() => initI18n("en"));
afterEach(() => {
  Platform.OS = originalOS;
});

it("android: pages in a tab do not pad the side insets again (the root SideSafeArea already does)", async () => {
  Platform.OS = "android";
  await render(<TabStack />);
  const o = screenOptions({ route: { name: "stats" } });
  expect(o.contentStyle?.paddingLeft ?? 0).toBe(0);
  expect(o.contentStyle?.paddingRight ?? 0).toBe(0);
});

it("android: the rule form keeps its own header (no native header or modal on top)", async () => {
  Platform.OS = "android";
  await render(<TabStack />);
  const o = screenOptions({ route: { name: "recurring/[id]" } });
  expect(o.headerShown).not.toBe(true);
  expect(o.presentation).not.toBe("modal");
});

it("ios: pages in a tab pad the side insets (the root does not) and the rule form is a native sheet", async () => {
  Platform.OS = "ios";
  await render(<TabStack />);
  expect(screenOptions({ route: { name: "stats" } }).contentStyle).toMatchObject({ paddingLeft: 40, paddingRight: 40 });
  expect(screenOptions({ route: { name: "recurring/[id]" } })).toMatchObject({ presentation: "modal", headerShown: true });
});
