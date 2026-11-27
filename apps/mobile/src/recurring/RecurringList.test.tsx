import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { testDb } from "@/db/testing/testDb";
import type { AppDb, NewRecurringRuleInput } from "@/db/types";
import { initI18n } from "@/i18n";
import { formatMoney } from "@/money/money";
import type { Layout } from "@/layout/layout";
import { LAYOUTS } from "@/layout/testing/layouts";
import type { FxCache } from "@/prefs/prefs";
import { contrast } from "@/theme/contrast";
import { darkColors, lightColors, type ColorTokens } from "@/theme/tokens";

import { CATCH_UP_BANNER_TEXT } from "./CatchUpBanner";
import { monthlyEquivalent } from "./format";
import { RECURRING_LIST_TEXT, RecurringList } from "./RecurringList";
import { RecurringScreen } from "./RecurringScreen";
import { createRule, listRules } from "./rules";
import { runAsAndroid } from "../../test/androidPlatform";

let mockDb: AppDb;
let mockFx: FxCache = { base: "idr", latestDate: null, fetchedAt: null, byDate: {} };
let mockLayout: Layout = LAYOUTS.phone;
let mockParams: { selected?: string } = {};
const mockRouter = { push: jest.fn(), setParams: jest.fn(), back: jest.fn() };
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => (k === "homeCurrency" ? "IDR" : k === "fxTables" ? mockFx : undefined),
}));
jest.mock("@/layout/useLayout", () => ({ useLayout: () => mockLayout }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-router", () =>
  // Object.assign keeps the getters lazy (a spread would read them before the mocks exist).
  Object.assign(
    {
      get router() {
        return mockRouter;
      },
      useLocalSearchParams: () => mockParams,
      useFocusEffect: (cb: () => void | (() => void)) => {
        const { useEffect } = jest.requireActual("react");
        useEffect(() => cb(), [cb]);
      },
    },
    jest.requireActual("../../test/expoRouterStack").stackMock,
  ),
);
jest.mock("@/components/DateField", () => ({ DateField: jest.requireActual("@/components/DateFieldText").DateFieldText }));
jest.mock("@/dates/clock", () => ({
  ...jest.requireActual("@/dates/clock"),
  now: () => new Date("2026-11-20T05:00:00Z"),
}));
jest.mock("./deviceScheduler", () => ({ deviceScheduler: {} }));
jest.mock("./notify", () => ({ ensurePermissionForDraftRule: jest.fn(async () => true), rescheduleAll: jest.fn(async () => 0) }));

const TZ = "Europe/Paris"; // test/globalTz.js
const NOW = new Date("2026-11-20T05:00:00Z");

function rule(over: Partial<NewRecurringRuleInput> = {}) {
  return createRule(
    mockDb,
    {
      merchant: "Netflix",
      currency: "IDR",
      totalMinor: 18600000,
      taxMinor: null,
      categoryId: null,
      folderId: null,
      notes: null,
      frequency: "monthly",
      anchorDate: "2026-11-01",
      monthDay: 1,
      tz: TZ,
      autoAdd: true,
      endDate: null,
      ...over,
    },
    NOW,
  );
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
  mockFx = { base: "idr", latestDate: null, fetchedAt: null, byDate: {} };
  mockLayout = LAYOUTS.phone;
  mockParams = {};
  jest.clearAllMocks();
});

const noop = () => {};
const idr = (minor: number) => formatMoney(minor, "IDR", "en");

// The in-page header and footer are Android's; iOS uses the native header (ScreenHeader.test).
runAsAndroid();

describe("RecurringList", () => {
  it("each row shows merchant, amount, frequency and the next date", async () => {
    const r = rule();
    await render(<RecurringList selectedId={null} onSelect={noop} onNew={noop} />);
    const row = within(screen.getByTestId(`recurring-row-${r.id}`));
    expect(row.getByText("Netflix")).toBeTruthy();
    expect(row.getByText(idr(18600000))).toBeTruthy();
    expect(row.getByText("Monthly, next 1 Dec")).toBeTruthy();
  });

  it("draft-type rules show the amount as an estimate and ask to confirm; paused rules say so", async () => {
    const draft = rule({ merchant: "Electricity", totalMinor: 25000000, monthDay: 5, autoAdd: false });
    const paused = rule({ merchant: "Gym" });
    const { setPaused } = jest.requireActual("./rules");
    setPaused(mockDb, paused.id, true, NOW);
    await render(<RecurringList selectedId={null} onSelect={noop} onNew={noop} />);
    const row = within(screen.getByTestId(`recurring-row-${draft.id}`));
    expect(row.getByText("~ ")).toBeTruthy();
    expect(row.getByText("Monthly, next 5 Dec. Asks you to confirm.")).toBeTruthy();
    expect(screen.getByTestId(`recurring-row-${draft.id}`).props.accessibilityLabel).toContain(`About ${idr(25000000)}`);
    expect(within(screen.getByTestId(`recurring-row-${paused.id}`)).getByText("Monthly, paused")).toBeTruthy();
  });

  it("the header shows the monthly equivalent in home currency (weekly x 52 / 12, yearly / 12)", async () => {
    rule({ totalMinor: 18600000 }); // monthly 186,000
    rule({ merchant: "Coffee", frequency: "weekly", monthDay: null, totalMinor: 3000000 }); // 30,000 x 52 / 12 = 130,000
    rule({ merchant: "Domain", frequency: "yearly", monthDay: null, totalMinor: 15000000 }); // 150,000 / 12 = 12,500
    await render(<RecurringList selectedId={null} onSelect={noop} onNew={noop} />);
    expect(screen.getByTestId("recurring-total").props.children).toBe(`About ${idr(32850000)} a month`);
    expect(screen.queryByText("Some amounts aren't included because their exchange rate isn't available yet.")).toBeNull();
  });

  it("converts foreign rules at today's cached rate and notes the ones without a rate", async () => {
    mockFx = { base: "idr", latestDate: "2026-11-19", fetchedAt: null, byDate: { "2026-11-19": { usd: "0.0000625" } } };
    rule({ merchant: "Spotify", currency: "USD", totalMinor: 1000 }); // $10 = Rp 160,000
    rule({ merchant: "Hosting", currency: "EUR", totalMinor: 500 }); // no EUR rate
    await render(<RecurringList selectedId={null} onSelect={noop} onNew={noop} />);
    expect(screen.getByTestId("recurring-total").props.children).toBe(`About ${idr(16000000)} a month`);
    expect(screen.getByText("Some amounts aren't included because their exchange rate isn't available yet.")).toBeTruthy();
  });

  it("rounds to minor units once, at the end", () => {
    const rules = [rule({ frequency: "weekly", monthDay: null, totalMinor: 1 }), rule({ frequency: "weekly", monthDay: null, totalMinor: 1 })];
    // 2 x (1 x 52 / 12) = 8.67 -> 9 (per-rule rounding would give 4 + 4 = 8).
    expect(monthlyEquivalent(rules, "IDR", mockFx, "2026-11-20")).toEqual({ homeMinor: 9, skipped: 0 });
  });

  it("empty state invites a first rule", async () => {
    const onNew = jest.fn();
    await render(<RecurringList selectedId={null} onSelect={noop} onNew={onNew} />);
    expect(screen.getByText("No recurring expenses yet")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("recurring-empty-new"));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});

const visible = (id: string) =>
  StyleSheet.flatten(screen.getByTestId(id, { includeHiddenElements: true }).props.style).display !== "none";

describe("RecurringScreen layouts", () => {
  it.each(["phone", "duoClosed", "duoSideways", "flipCover"] as const)("%s: the list alone; a tapped rule pushes the form", async (name) => {
    mockLayout = LAYOUTS[name];
    const r = rule();
    await render(<RecurringScreen />);
    expect(visible("pane-primary")).toBe(true);
    expect(visible("pane-secondary")).toBe(false);
    await fireEvent.press(screen.getByTestId(`recurring-row-${r.id}`));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/recurring/[id]", params: { id: r.id } });
    await fireEvent.press(screen.getByTestId("recurring-new"));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: "/recurring/[id]", params: { id: "new" } });
  });

  it("duoPortrait: icon rail and one pane (the list; a rule pushes the form)", async () => {
    mockLayout = LAYOUTS.duoPortrait;
    expect(mockLayout).toMatchObject({ nav: "iconRail", split: false });
    const r = rule();
    await render(<RecurringScreen />);
    expect(visible("pane-secondary")).toBe(false);
    await fireEvent.press(screen.getByTestId(`recurring-row-${r.id}`));
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });

  it.each(["duoLandscape", "foldInner", "foldInnerPortrait"] as const)("%s: list and form side by side, form pane at least 280 dp", async (name) => {
    mockLayout = LAYOUTS[name];
    const r = rule();
    await render(<RecurringScreen />);
    expect(visible("pane-primary")).toBe(true);
    expect(visible("pane-secondary")).toBe(true);
    expect(screen.getByTestId("recurring-placeholder")).toBeTruthy();
    expect(mockLayout.paneArea - mockLayout.listWidth).toBeGreaterThanOrEqual(280);
    await fireEvent.press(screen.getByTestId(`recurring-row-${r.id}`));
    expect(mockRouter.setParams).toHaveBeenCalledWith({ selected: r.id });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("duoLandscape with a selected rule shows its form beside the selected row", async () => {
    mockLayout = LAYOUTS.duoLandscape;
    const r = rule();
    mockParams = { selected: r.id };
    await render(<RecurringScreen />);
    expect(screen.getByText("Edit recurring expense")).toBeTruthy();
    expect(screen.getByTestId(`recurring-row-${r.id}`).props.accessibilityState.selected).toBe(true);
    // Split: no back control in the form pane.
    expect(within(screen.getByTestId("pane-secondary")).queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("duoClosed -> duoLandscape keeps typed values and the selected rule", async () => {
    mockLayout = LAYOUTS.duoClosed;
    const r = rule();
    mockParams = { selected: r.id };
    const view = await render(<RecurringScreen />);
    // Folded with a rule open: the form alone, with a back control.
    expect(visible("pane-primary")).toBe(false);
    expect(within(screen.getByTestId("pane-secondary")).getByRole("button", { name: "Back" })).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("rule-merchant"), "Netflix Premium");
    await fireEvent.changeText(screen.getByTestId("rule-amount"), "200.000");

    mockLayout = LAYOUTS.duoLandscape;
    await view.rerender(<RecurringScreen />);
    expect(visible("pane-primary")).toBe(true);
    expect(visible("pane-secondary")).toBe(true);
    expect(screen.getByTestId("rule-merchant").props.value).toBe("Netflix Premium");
    expect(screen.getByTestId("rule-amount").props.value).toBe("200.000");
    expect(screen.getByTestId(`recurring-row-${r.id}`).props.accessibilityState.selected).toBe(true);
  });

  it("split: saving a new rule selects it", async () => {
    mockLayout = LAYOUTS.foldInner;
    mockParams = { selected: "new" };
    await render(<RecurringScreen />);
    await fireEvent.changeText(screen.getByTestId("rule-amount"), "50.000");
    await fireEvent.press(screen.getByTestId("rule-save"));
    const [saved] = listRules(mockDb);
    expect(mockRouter.setParams).toHaveBeenCalledWith({ selected: saved.id });
  });
});

describe.each([
  ["light", lightColors as ColorTokens],
  ["dark", darkColors],
])("%s contrast", (_name, colors) => {
  it.each([...RECURRING_LIST_TEXT, ...CATCH_UP_BANNER_TEXT])("list text and banner text: %s on %s ≥ 4.5", (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
