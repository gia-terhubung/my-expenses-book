import { fireEvent, render, screen } from "@testing-library/react-native";

import Settings from "@/app/(tabs)/settings";
import { initI18n } from "@/i18n";

const mockPush = jest.fn();
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => ({ language: "en", homeCurrency: "USD", taxYearStartMonth: 1, lockEnabled: false, lockTimeout: 60 })[k],
  usePrefs: () => ({ set: jest.fn() }),
}));
jest.mock("expo-router", () => ({
  Link: require("react-native").Text,
  router: { push: (...a: unknown[]) => mockPush(...a) },
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
