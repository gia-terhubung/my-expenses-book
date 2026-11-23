import { fireEvent, render, screen } from "@testing-library/react-native";

import GuideRoute from "@/app/guide";
import { initI18n } from "@/i18n";
import { createPrefs, type KV, type Prefs, type PrefsStore } from "@/prefs/prefs";

let mockStore: PrefsStore;
jest.mock("@/prefs/PrefsProvider", () => ({
  usePrefs: () => mockStore,
  usePref: (k: keyof Prefs) => jest.requireActual("@/prefs/prefs").usePrefFrom(mockStore, k),
}));
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageTag: "en-US", languageCode: "en", currencyCode: "USD", regionCode: "US" }],
}));
jest.mock("expo-local-authentication", () => ({
  getEnrolledLevelAsync: jest.fn().mockResolvedValue(0),
  hasHardwareAsync: jest.fn().mockResolvedValue(false),
  SecurityLevel: { NONE: 0, SECRET: 1 },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockBack = jest.fn();
jest.mock("expo-router", () => ({ router: { back: () => mockBack(), replace: jest.fn() } }));

function memoryKv(): KV {
  const data = new Map<string, string>();
  return { getString: (k) => data.get(k), set: (k, v) => void data.set(k, v), delete: (k) => void data.delete(k) };
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockStore = createPrefs(memoryKv());
  mockStore.set("onboardingStep", "done");
  mockStore.set("language", "en");
  mockBack.mockClear();
});

describe("/guide", () => {
  it("marks guideSeen and starts at the language step", async () => {
    await render(<GuideRoute />);
    expect(mockStore.get("guideSeen")).toBe(true);
    expect(screen.getByRole("header", { name: "Choose your language" })).toBeTruthy();
  });

  it("on iOS the replay modal keeps out of the side strips (own window, outside SideSafeArea)", async () => {
    const { Platform } = jest.requireActual("react-native");
    const original = Platform.OS;
    Platform.OS = "ios";
    try {
      await render(<GuideRoute />);
      expect(screen.getByTestId("modal-side-inset")).toBeTruthy();
    } finally {
      Platform.OS = original;
    }
  });

  it("on Android the replay is already inside SideSafeArea: no second inset", async () => {
    const { Platform } = jest.requireActual("react-native");
    const original = Platform.OS;
    Platform.OS = "android";
    try {
      await render(<GuideRoute />);
      expect(screen.queryByTestId("modal-side-inset")).toBeNull();
    } finally {
      Platform.OS = original;
    }
  });

  it("Close goes back", async () => {
    await render(<GuideRoute />);
    await fireEvent.press(screen.getByRole("button", { name: "Close guide" }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
