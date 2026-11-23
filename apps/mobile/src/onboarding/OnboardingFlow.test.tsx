import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useWindowDimensions } from "react-native";

import { initI18n } from "@/i18n";
import { createPrefs, type KV, type Prefs, type PrefsStore } from "@/prefs/prefs";

import { OnboardingFlow } from "./OnboardingFlow";

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

describe("OnboardingFlow", () => {
  it("resumes on the persisted step (currency) instead of language", async () => {
    mockStore.set("onboardingStep", "currency");
    await render(<OnboardingFlow />);
    expect(screen.getByText("Choose your home currency")).toBeTruthy();
    expect(screen.queryByText("Choose your language")).toBeNull();
  });

  it("language step preselects the device language; Next persists the step", async () => {
    await render(<OnboardingFlow />);
    expect(screen.getByText("Choose your language")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Bahasa Indonesia", checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByText("Next"));
    expect(mockStore.get("onboardingStep")).toBe("currency");
    expect(mockStore.get("language")).toBe("id");
  });

  it("picking a language persists it right away (live switch via prefs)", async () => {
    await render(<OnboardingFlow />);
    await fireEvent.press(screen.getByRole("radio", { name: "Español" }));
    expect(mockStore.get("language")).toBe("es");
  });

  it("currency step preselects locale currency, sets tax year silently, and survives a width change", async () => {
    mockStore.set("onboardingStep", "currency");
    const { rerender } = await render(<OnboardingFlow />);
    expect(screen.getByRole("radio", { name: /^IDR/, checked: true })).toBeTruthy();
    await fireEvent.changeText(screen.getByPlaceholderText("Search"), "eur");
    await fireEvent.press(screen.getByRole("radio", { name: /^EUR/ }));
    dims.mockReturnValue({ width: 900, height: 600, scale: 2, fontScale: 1 });
    await rerender(<OnboardingFlow />);
    expect(screen.getByDisplayValue("eur")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /^EUR/, checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByText("Next"));
    expect(mockStore.get("homeCurrency")).toBe("EUR");
    expect(mockStore.get("taxYearStartMonth")).toBe(1);
    expect(mockStore.get("onboardingStep")).toBe("taxYear");
  });

  it("lock step: enable disabled with reason when unavailable; Skip finishes", async () => {
    mockStore.set("onboardingStep", "lock");
    await render(<OnboardingFlow />);
    await act(async () => {});
    expect(screen.getByText(/no biometrics or passcode/)).toBeTruthy();
    expect(screen.getByRole("switch").props.accessibilityState?.disabled ?? screen.getByRole("switch").props.disabled).toBeTruthy();
    await fireEvent.press(screen.getByText("Not now"));
    expect(mockStore.get("onboardingStep")).toBe("done");
    expect(mockStore.get("lockEnabled")).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith("/");
  });
});
