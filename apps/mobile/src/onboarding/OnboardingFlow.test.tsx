import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { useWindowDimensions } from "react-native";

import { deviceTimeZone, formatLocal } from "@/capture/localTime";
import { now } from "@/dates/clock";
import { payCycleExample } from "@/guide/examples";
import { initI18n } from "@/i18n";
import { defaultTaxYearStartMonth } from "@/i18n/resolve";
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
jest.mock("expo-router", () => ({
  ...jest.requireActual("../../test/expoRouterStack").stackMock, router: { replace: (...a: unknown[]) => mockReplace(...a) } }));
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
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    await fireEvent.press(screen.getByText("Next"));
    expect(mockStore.get("onboardingStep")).toBe("currency");
    expect(mockStore.get("language")).toBe("id");
  });

  it("picking a language persists it right away (live switch via prefs)", async () => {
    await render(<OnboardingFlow />);
    await fireEvent.press(screen.getByRole("radio", { name: "Español" }));
    expect(mockStore.get("language")).toBe("es");
  });

  it("first run walks language → currency → tax year → pay cycle → lock", async () => {
    mockStore.set("language", "en");
    await render(<OnboardingFlow />);
    for (const title of [
      "Choose your language",
      "Choose your home currency",
      "When does your tax year start?",
      "When does your month start?",
      "Protect your receipts",
    ]) {
      expect(screen.getByRole("header", { name: title })).toBeTruthy();
      await act(async () => {});
      if (title !== "Protect your receipts") await fireEvent.press(screen.getByText("Next"));
    }
  });

  it("shows the step position", async () => {
    mockStore.set("onboardingStep", "payCycle");
    await render(<OnboardingFlow />);
    expect(screen.getByLabelText("Step 4 of 5")).toBeTruthy();
  });

  it("currency step preselects locale currency, no longer sets tax year, and survives a width change", async () => {
    mockStore.set("onboardingStep", "currency");
    mockStore.set("taxYearStartMonth", 7);
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
    expect(mockStore.get("taxYearStartMonth")).toBe(7);
    expect(mockStore.get("onboardingStep")).toBe("taxYear");
  });

  it("unfold mid-step keeps currency search text", async () => {
    mockStore.set("onboardingStep", "currency");
    dims.mockReturnValue({ width: 466, height: 678, scale: 3, fontScale: 1 });
    const { rerender } = await render(<OnboardingFlow />);
    await fireEvent.changeText(screen.getByPlaceholderText("Search"), "yen");
    dims.mockReturnValue({ width: 951, height: 669, scale: 3, fontScale: 1 });
    await rerender(<OnboardingFlow />);
    expect(screen.getByDisplayValue("yen")).toBeTruthy();
    dims.mockReturnValue({ width: 678, height: 466, scale: 3, fontScale: 1 });
    await rerender(<OnboardingFlow />);
    expect(screen.getByDisplayValue("yen")).toBeTruthy();
  });

  it("tax year preselects the regional default and Next saves it", async () => {
    mockStore.set("onboardingStep", "taxYear");
    mockStore.set("language", "en");
    mockStore.set("taxYearStartMonth", 9);
    await render(<OnboardingFlow />);
    const regional = defaultTaxYearStartMonth("ID");
    const month = new Date(2000, regional - 1, 1).toLocaleDateString("en", { month: "long" });
    expect(screen.getByRole("radio", { name: month, checked: true })).toBeTruthy();
    await fireEvent.press(screen.getByText("Next"));
    expect(mockStore.get("taxYearStartMonth")).toBe(regional);
    expect(mockStore.get("onboardingStep")).toBe("payCycle");
  });

  it("Back on pay cycle returns to tax year, persists the step, and shows the saved value", async () => {
    mockStore.set("onboardingStep", "payCycle");
    mockStore.set("language", "en");
    mockStore.set("taxYearStartMonth", 4);
    await render(<OnboardingFlow />);
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockStore.get("onboardingStep")).toBe("taxYear");
    expect(screen.getByRole("radio", { name: "April", checked: true })).toBeTruthy();
  });

  it("pay cycle example follows the picked day", async () => {
    mockStore.set("onboardingStep", "payCycle");
    mockStore.set("language", "en");
    await render(<OnboardingFlow />);
    await fireEvent.press(screen.getByRole("radio", { name: "Day 25" }));
    expect(mockStore.get("monthStartDay")).toBe(25);
    const today = formatLocal(now(), deviceTimeZone()).slice(0, 10);
    expect(screen.getByText(payCycleExample(today, 25, "en"))).toBeTruthy();
    expect(screen.getByText(/^Only days 1–28/)).toBeTruthy();
  });

  it("legacy stored 'lock' leads to the tour, not Home", async () => {
    mockStore.set("onboardingStep", "lock");
    await render(<OnboardingFlow />);
    await act(async () => {});
    expect(screen.getByText(/no biometrics or passcode/)).toBeTruthy();
    expect(screen.getByRole("switch").props.accessibilityState?.disabled ?? screen.getByRole("switch").props.disabled).toBeTruthy();
    await fireEvent.press(screen.getByText("Not now"));
    expect(mockStore.get("onboardingStep")).toBe("tour");
    expect(mockStore.get("lockEnabled")).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("finishing the tour sets done and guideSeen and goes Home", async () => {
    mockStore.set("onboardingStep", "tour");
    mockStore.set("language", "en");
    await render(<OnboardingFlow />);
    await fireEvent.press(screen.getByRole("button", { name: "Skip" }));
    expect(mockStore.get("onboardingStep")).toBe("done");
    expect(mockStore.get("guideSeen")).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("first run has no Close button", async () => {
    mockStore.set("onboardingStep", "taxYear");
    mockStore.set("language", "en");
    await render(<OnboardingFlow />);
    expect(screen.queryByRole("button", { name: "Close guide" })).toBeNull();
  });
});
