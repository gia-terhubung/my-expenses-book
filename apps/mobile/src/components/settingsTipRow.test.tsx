import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import Settings from "@/app/(tabs)/settings";
import { initI18n } from "@/i18n";
import { tokens } from "@/theme/tokens";

jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => ({ language: "en", homeCurrency: "USD", taxYearStartMonth: 1, lockEnabled: false, lockTimeout: 60 })[k],
  usePrefs: () => ({ set: jest.fn() }),
}));
jest.mock("expo-router", () => {
  const mockReact = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual("../../test/expoRouterStack").stackMock,
    Link: jest.requireActual<typeof import("react-native")>("react-native").Text,
    useFocusEffect: (cb: () => void) => mockReact.useEffect(cb, []),
  };
});
jest.mock("expo-web-browser", () => ({ openBrowserAsync: jest.fn() }));
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => ({}) }));
jest.mock("@/images/expoFs", () => ({ fileSize: async () => 0 }));
jest.mock("@/about/storageStats", () => ({
  storageStats: async () => ({ receipts: 0, pages: 0, bytes: 0 }),
  formatBytes: () => "0 kB",
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const light = tokens.light.colors;
function flat(node: { props: { style?: unknown } }) {
  const s = node.props.style;
  return StyleSheet.flatten(typeof s === "function" ? s({ pressed: false }) : (s as object));
}

beforeAll(() => initI18n("en"));

it("the tip jar row is a yellow highlight with ink text and a hidden coffee icon", async () => {
  await render(<Settings />);
  const row = screen.getByRole("button", { name: "Tip jar" });
  expect(flat(row).backgroundColor).toBe(light.highlight);
  expect(flat(screen.getByText("Tip jar")).color).toBe(light.onHighlight);
  const icon = screen.getByTestId("settings-tip-icon", { includeHiddenElements: true });
  expect(icon.props.accessibilityElementsHidden).toBe(true);
  expect(icon.props.importantForAccessibility).toBe("no-hide-descendants");
});

it("other rows keep the plain surface", async () => {
  await render(<Settings />);
  expect(flat(screen.getByRole("button", { name: "Error log" })).backgroundColor).toBe(light.surface);
});
