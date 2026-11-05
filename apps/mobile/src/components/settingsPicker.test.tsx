import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useEffect, useState } from "react";

import Settings from "@/app/(tabs)/settings";
import { initI18n } from "@/i18n";
import { AppObscuredContext } from "@/lock/appObscured";

jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => ({ language: "en", homeCurrency: "USD", taxYearStartMonth: 1, lockEnabled: false, lockTimeout: 60 })[k],
  usePrefs: () => ({ set: jest.fn() }),
}));
jest.mock("expo-router", () => ({ Link: require("react-native").Text }));
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
