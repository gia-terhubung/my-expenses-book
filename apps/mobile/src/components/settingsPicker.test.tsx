import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useEffect, useState } from "react";

import Settings from "@/app/(tabs)/(receipts,search,folders,settings)/settings";
import { initI18n } from "@/i18n";
import { AppObscuredContext } from "@/lock/appObscured";

jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => ({ language: "en", homeCurrency: "USD", taxYearStartMonth: 1, monthStartDay: 25, lockEnabled: false, lockTimeout: 60 })[k],
  usePrefs: () => ({ set: jest.fn() }),
}));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  ...jest.requireActual("../../test/expoRouterStack").stackMock,
  router: { push: (...a: unknown[]) => mockPush(...a) },
  Link: require("react-native").Text,
  useFocusEffect: (cb: () => void) => require("react").useEffect(cb, []),
}));
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

let setObscured: (v: boolean) => void = () => {};
function Host() {
  const [o, set] = useState(false);
  useEffect(() => {
    setObscured = set;
  }, []);
  return (
    <AppObscuredContext.Provider value={o}>
      <Settings />
    </AppObscuredContext.Provider>
  );
}

beforeAll(() => initI18n("en"));

it("closes an open picker sheet when the app locks, and does not reopen it", async () => {
  await render(<Host />);
  await fireEvent.press(screen.getByLabelText(/^Language,/));
  expect(screen.getByText("Done")).toBeTruthy();
  await act(async () => setObscured(true));
  expect(screen.queryByText("Done")).toBeNull();
  await act(async () => setObscured(false));
  expect(screen.queryByText("Done")).toBeNull();
});

it("Pay cycle starts on row shows the day and opens the day grid with the helper text", async () => {
  await render(<Host />);
  expect(screen.getByLabelText("Pay cycle starts on, Day 25")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Pay cycle starts on, Day 25"));
  expect(screen.getAllByLabelText(/^Day \d+$/)).toHaveLength(28);
  expect(screen.getByLabelText("Day 25").props.accessibilityState.checked).toBe(true);
  expect(screen.getByText(/^Pick the day you get paid\./)).toBeTruthy();
  expect(screen.getByText(/^Only days 1–28/)).toBeTruthy();
  expect(screen.getByText("Used by Home and Statistics. Exports and search use calendar months.")).toBeTruthy();
  // Inline text in the picker sheet, no (i) on top of a sheet.
  expect(screen.queryAllByRole("button", { name: "About Pay cycle" })).toHaveLength(1);
});

it("Show guide (in Help) opens /guide", async () => {
  await render(<Host />);
  expect(screen.getByRole("header", { name: "Help" })).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Show guide"));
  expect(mockPush).toHaveBeenCalledWith("/guide");
});

it("tax year (i) opens the Tax year sheet without opening the picker", async () => {
  await render(<Host />);
  await fireEvent.press(screen.getByRole("button", { name: "About Tax year" }));
  expect(screen.getByRole("header", { name: "Tax year" })).toBeTruthy();
  expect(screen.queryByRole("radio", { name: "April" })).toBeNull();
});

it("Settings (i) sheets carry the guide's live example", async () => {
  const { payCycleExample, taxYearExample } = jest.requireActual("@/guide/examples");
  const { deviceTimeZone, formatLocal } = jest.requireActual("@/capture/localTime");
  const today = formatLocal(new Date(), deviceTimeZone()).slice(0, 10);
  await render(<Host />);
  await fireEvent.press(screen.getByRole("button", { name: "About Pay cycle" }));
  expect(screen.getByText(`This month: ${payCycleExample(today, 25, "en")}`)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Done" }));
  await fireEvent.press(screen.getByRole("button", { name: "About Tax year" }));
  expect(screen.getByText(`Tax year ${taxYearExample(today, 1, "en").label}: ${taxYearExample(today, 1, "en").range}`)).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Done" }));
  await fireEvent.press(screen.getByRole("button", { name: "About Home currency" }));
  expect(screen.getByText(/A €12\.00 receipt shows as about/)).toBeTruthy();
});

it("home currency and pay cycle rows have their (i)", async () => {
  await render(<Host />);
  expect(screen.getByRole("button", { name: "About Home currency" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "About Pay cycle" })).toBeTruthy();
});
