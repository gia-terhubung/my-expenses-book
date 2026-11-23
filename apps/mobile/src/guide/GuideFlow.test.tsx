import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useWindowDimensions } from "react-native";

import { initI18n } from "@/i18n";
import { createPrefs, type KV, type Prefs, type PrefsStore } from "@/prefs/prefs";

import { GuideFlow } from "./GuideFlow";

let mockStore: PrefsStore;
jest.mock("@/prefs/PrefsProvider", () => ({
  usePrefs: () => mockStore,
  usePref: (k: keyof Prefs) => jest.requireActual("@/prefs/prefs").usePrefFrom(mockStore, k),
}));
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageTag: "id-ID", languageCode: "id", currencyCode: "IDR", regionCode: "ID" }],
}));
jest.mock("expo-local-authentication", () => ({
  getEnrolledLevelAsync: jest.fn().mockResolvedValue(0),
  hasHardwareAsync: jest.fn().mockResolvedValue(false),
  SecurityLevel: { NONE: 0, SECRET: 1 },
}));
const mockReplace = jest.fn();
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router", () => ({ router: { replace: (...a: unknown[]) => mockReplace(...a) } }));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn(),
}));
const dims = useWindowDimensions as jest.Mock;

function memoryKv(): KV {
  const data = new Map<string, string>();
  return {
    getString: (k) => data.get(k),
    set: (k, v) => void data.set(k, v),
    delete: (k) => void data.delete(k),
  };
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockStore = createPrefs(memoryKv());
  dims.mockReturnValue({ width: 400, height: 800, scale: 2, fontScale: 1 });
  mockReplace.mockClear();
});

describe("GuideFlow replay", () => {
  it("replay never writes onboardingStep", async () => {
    mockStore.set("onboardingStep", "done");
    mockStore.set("language", "en");
    await render(<GuideFlow mode="replay" onClose={jest.fn()} />);
    for (let i = 0; i < 5; i++) {
      await act(async () => {});
      await fireEvent.press(screen.getByText(i === 4 ? "Not now" : "Next"));
    }
    expect(mockStore.get("onboardingStep")).toBe("done");
  });

  it("replay Close calls onClose", async () => {
    mockStore.set("language", "en");
    const onClose = jest.fn();
    await render(<GuideFlow mode="replay" onClose={onClose} />);
    await fireEvent.press(screen.getByRole("button", { name: "Close guide" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("replay tax year shows the saved month and saves a change right away", async () => {
    mockStore.set("language", "en");
    mockStore.set("taxYearStartMonth", 4);
    await render(<GuideFlow mode="replay" onClose={jest.fn()} />);
    await fireEvent.press(screen.getByText("Next"));
    await fireEvent.press(screen.getByText("Next"));
    expect(screen.getByRole("radio", { name: "April", checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("radio", { name: "July" }));
    expect(mockStore.get("taxYearStartMonth")).toBe(7);
  });

  it("changing language in replay re-renders the next step in that language", async () => {
    mockStore.set("language", "en");
    const { rerender } = await render(<GuideFlow mode="replay" onClose={jest.fn()} />);
    await fireEvent.press(screen.getByRole("radio", { name: "Bahasa Indonesia" }));
    expect(mockStore.get("language")).toBe("id");
    // PrefsProvider switches i18n on a language change; here the test does it.
    await act(async () => {
      initI18n("id");
    });
    await rerender(<GuideFlow mode="replay" onClose={jest.fn()} />);
    await fireEvent.press(screen.getByText("Berikutnya"));
    expect(screen.getByRole("header", { name: "Pilih mata uang utama Anda" })).toBeTruthy();
    initI18n("en");
  });
});
