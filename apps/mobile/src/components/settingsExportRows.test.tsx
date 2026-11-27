import { fireEvent, render, screen } from "@testing-library/react-native";

import Settings from "@/app/(tabs)/settings";
import { initI18n } from "@/i18n";

const mockPush = jest.fn();
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => ({ language: "en", homeCurrency: "USD", taxYearStartMonth: 1, lockEnabled: false, lockTimeout: 60 })[k],
  usePrefs: () => ({ set: jest.fn() }),
}));
const mockOpen = jest.fn();
jest.mock("expo-router", () => ({
  ...jest.requireActual("../../test/expoRouterStack").stackMock,
  Link: require("react-native").Text,
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useFocusEffect: (cb: () => void) => require("react").useEffect(cb, []),
}));
jest.mock("expo-web-browser", () => ({ openBrowserAsync: (...a: unknown[]) => mockOpen(...a) }));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { version: "1.0.0" } } }));
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => ({}) }));
jest.mock("@/images/expoFs", () => ({ fileSize: async () => 0 }));
jest.mock("@/about/storageStats", () => ({
  storageStats: async () => ({ receipts: 2, pages: 3, bytes: 1_500_000 }),
  formatBytes: () => "1.5 MB",
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

beforeAll(() => initI18n("en"));
beforeEach(() => mockPush.mockClear());

it("Export row pushes /export", async () => {
  await render(<Settings />);
  await fireEvent.press(screen.getByRole("button", { name: "Export" }));
  expect(mockPush).toHaveBeenCalledWith("/export");
});

it("Backup & restore row pushes /backup", async () => {
  await render(<Settings />);
  await fireEvent.press(screen.getByRole("button", { name: "Backup & restore" }));
  expect(mockPush).toHaveBeenCalledWith("/backup");
});

it("Recurring row pushes /recurring", async () => {
  await render(<Settings />);
  await fireEvent.press(screen.getByRole("button", { name: "Recurring" }));
  expect(mockPush).toHaveBeenCalledWith("/recurring");
});

it("Tip jar and Error log rows push their routes", async () => {
  await render(<Settings />);
  await fireEvent.press(screen.getByRole("button", { name: "Tip jar" }));
  expect(mockPush).toHaveBeenCalledWith("/tip-jar");
  await fireEvent.press(screen.getByRole("button", { name: "Error log" }));
  expect(mockPush).toHaveBeenCalledWith("/error-log");
});

it("Privacy policy opens the live policy page, not a placeholder", async () => {
  await render(<Settings />);
  await fireEvent.press(screen.getByRole("button", { name: "Privacy policy" }));
  // A literal URL: comparing with the constant let a placeholder URL pass unnoticed.
  expect(mockOpen).toHaveBeenCalledWith("https://meb.terhubung.app/privacy");
});

it("Terms of use opens the live terms page", async () => {
  await render(<Settings />);
  await fireEvent.press(screen.getByRole("button", { name: "Terms of use" }));
  expect(mockOpen).toHaveBeenCalledWith("https://meb.terhubung.app/terms");
});

it("Storage and Version rows show their values", async () => {
  await render(<Settings />);
  expect(await screen.findByLabelText("Storage, 2 receipts · 1.5 MB")).toBeTruthy();
  expect(screen.getByLabelText("Version, 1.0.0")).toBeTruthy();
});

it("the row chevron is hidden from screen readers", async () => {
  await render(<Settings />);
  const chevrons = screen.getAllByText("›", { includeHiddenElements: true });
  expect(chevrons.length).toBeGreaterThan(0);
  for (const c of chevrons) expect(c.props.importantForAccessibility).toBe("no");
});
