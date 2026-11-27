import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { deviceTimeZone, formatLocal } from "@/capture/localTime";
import { createReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n, setLanguage } from "@/i18n";
import { listCategories } from "@/db/repositories/categories";
import { layoutFor, type Layout } from "@/layout/layout";
import { LAYOUTS } from "@/layout/testing/layouts";
import { formatMoney } from "@/money/money";
import { lightColors } from "@/theme/tokens";

import { TotalsHeader } from "./TotalsHeader";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  ...jest.requireActual("../../test/expoRouterStack").stackMock, router: { push: (...a: unknown[]) => mockPush(...a) } }));

let mockDb: AppDb;
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
let mockMonthStart = 1;
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => ({ homeCurrency: "IDR", taxYearStartMonth: 1, monthStartDay: mockMonthStart })[k],
}));

let mockLayout: Layout = LAYOUTS.phone;
jest.mock("@/layout/useLayout", () => ({ useLayout: () => mockLayout }));

function seed(totalMinor: number, currency: string, amountHomeMinor: number | null) {
  const local = formatLocal(new Date(), deviceTimeZone());
  return createReceipt(mockDb, {
    status: "confirmed",
    merchant: "Demo",
    purchasedAtLocal: local,
    purchasedTz: deviceTimeZone(),
    purchasedAtUtc: Date.now(),
    scannedAtUtc: Date.now(),
    scannedTz: deviceTimeZone(),
    currency,
    totalMinor,
    taxMinor: null,
    homeCurrencyAtSave: amountHomeMinor == null ? null : "IDR",
    amountHomeMinor,
    parseSource: "manual",
  });
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
  mockPush.mockClear();
  mockMonthStart = 1;
  mockLayout = LAYOUTS.phone;
});

/** A receipt on a fixed local day, optionally in a category; home amount in IDR. */
function seedOn(day: string, amount: number, categoryId: string | null = null) {
  return createReceipt(mockDb, {
    status: "confirmed",
    merchant: "Demo",
    purchasedAtLocal: `${day}T10:00:00`,
    purchasedTz: deviceTimeZone(),
    purchasedAtUtc: Date.now(),
    scannedAtUtc: Date.now(),
    scannedTz: deviceTimeZone(),
    currency: "IDR",
    totalMinor: amount,
    taxMinor: null,
    homeCurrencyAtSave: "IDR",
    amountHomeMinor: amount,
    parseSource: "manual",
    categoryId,
  });
}

/** Freeze only Date, so async rendering still runs on real timers. */
function fixToday(iso: string) {
  jest.useFakeTimers({
    now: new Date(iso),
    doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "setImmediate", "clearImmediate", "nextTick", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame", "performance"],
  });
}
afterEach(() => jest.useRealTimers());

describe("TotalsHeader pay period", () => {
  it("with month starting on the 25th, this month runs 25 Oct to 24 Nov", async () => {
    fixToday("2026-11-20T05:00:00Z");
    mockMonthStart = 25;
    seedOn("2026-10-24", 100);
    seedOn("2026-10-26", 200);
    await render(<TotalsHeader />);
    expect(screen.getByTestId("totals-slip").props.accessibilityLabel).toContain(`This month, ${formatMoney(200, "IDR", "en")}`);
  });
});

describe("TotalsHeader slip stats", () => {
  it("pace line shows ▲ 12% dibanding Oktober (s.d. tgl 16)", async () => {
    fixToday("2026-11-16T05:00:00Z");
    seedOn("2026-10-10", 1_000_000);
    seedOn("2026-10-20", 5_000_000); // after day 16: not in the comparison
    seedOn("2026-11-05", 1_120_000);
    await act(async () => void setLanguage("id"));
    try {
      await render(<TotalsHeader />);
      expect(screen.getByTestId("slip-pace")).toHaveTextContent("▲ 12% dibanding Oktober (s.d. tgl 16)");
      expect(screen.getByTestId("slip-pace-pct")).toHaveStyle({ color: lightColors.highlight });
    } finally {
      await act(async () => void setLanguage("en"));
    }
  });

  it("strip has top-3 + Lainnya segments and a legend", async () => {
    fixToday("2026-11-16T05:00:00Z");
    seedOn("2026-11-02", 400, "default:lodging");
    seedOn("2026-11-03", 300, "default:food");
    seedOn("2026-11-04", 200, "default:transport");
    seedOn("2026-11-05", 100, "default:health");
    await act(async () => void setLanguage("id"));
    try {
      await render(<TotalsHeader />);
      expect(screen.getAllByTestId(/^slip-strip-seg-/)).toHaveLength(4);
      const legend = screen.getByTestId("slip-legend");
      expect(within(legend).getByText("Lainnya")).toBeTruthy();
      expect(within(legend).getByText("40%")).toBeTruthy();
      expect(within(legend).getByText("10%")).toBeTruthy();
    } finally {
      await act(async () => void setLanguage("en"));
    }
  });

  it("whole slip is one button that opens /stats, label Lihat statistik", async () => {
    fixToday("2026-11-16T05:00:00Z");
    seedOn("2026-11-02", 400);
    await act(async () => void setLanguage("id"));
    try {
      await render(<TotalsHeader />);
      const slip = screen.getByRole("button", { name: /Lihat statistik/ });
      expect(slip.props.accessibilityLabel).toContain("Bulan ini");
      await fireEvent.press(slip);
      expect(mockPush).toHaveBeenCalledWith("/stats");
    } finally {
      await act(async () => void setLanguage("en"));
    }
  });

  it("not-converted note shows once, in the foot row, and stays in the button label", async () => {
    seedOn(formatLocal(new Date(), deviceTimeZone()).slice(0, 10), 400);
    seed(1_000, "USD", null);
    await render(<TotalsHeader />);
    expect(screen.getAllByText("1 not converted")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /See statistics/ }).props.accessibilityLabel).toContain("1 not converted");
  });

  it("with nothing unconverted the stats link is still there", async () => {
    seed(50_000, "IDR", 50_000);
    await render(<TotalsHeader />);
    expect(screen.queryByText(/not converted/)).toBeNull();
    expect(screen.getByText("See statistics ›")).toBeTruthy();
  });

  it("no pace line and no strip in the first month", async () => {
    fixToday("2026-11-16T05:00:00Z");
    seedOn("2026-11-02", 400, "default:food");
    await render(<TotalsHeader />);
    expect(screen.queryByTestId("slip-pace")).toBeNull();
    expect(screen.queryByTestId("slip-legend")).toBeNull();
    expect(screen.queryByTestId(/^slip-strip-seg-/)).toBeNull();
  });
});

describe("TotalsHeader (Ledger slip)", () => {
  it("amounts are single-line and shrink to fit", async () => {
    seed(19_823_884_100, "IDR", 19_823_884_100);
    await render(<TotalsHeader />);
    for (const id of ["slip-amount-month", "slip-amount-year"]) {
      const amount = screen.getByTestId(id);
      expect(amount.props.numberOfLines).toBe(1);
      expect(amount.props.adjustsFontSizeToFit).toBe(true);
      expect(amount.props.minimumFontScale).toBe(0.6);
      expect(amount.props.ellipsizeMode).toBeUndefined();
      expect(amount).toHaveStyle({ color: lightColors.slipText, fontVariant: ["tabular-nums"] });
    }
    expect(screen.getByTestId("slip-amount-month")).toHaveTextContent(formatMoney(19_823_884_100, "IDR", "en"));
  });

  it("the slip button label keeps the combined totalLine text; cells are not separate stops", async () => {
    seed(50_000, "IDR", 50_000);
    seed(1_000, "USD", null);
    await render(<TotalsHeader />);
    const money = formatMoney(50_000, "IDR", "en");
    expect(screen.getByTestId("totals-slip").props.accessibilityLabel).toContain(`This month, ${money} · 1 not converted`);
    // The button already carries every total: inner cells would make TalkBack read them twice.
    expect(screen.getByTestId("slip-cell-month").props.accessible).toBeFalsy();
    expect(screen.getByTestId("slip-cell-month").props.accessibilityLabel).toBeUndefined();
    expect(within(screen.getByTestId("slip-cell-month")).queryByText("1 not converted")).toBeNull();
  });

  it("dims on press", async () => {
    await render(<TotalsHeader />);
    const slip = screen.getByTestId("totals-slip");
    expect(slip).toHaveStyle({ opacity: 1 });
    await fireEvent(slip, "responderGrant", { nativeEvent: { touches: [] }, persist() {} });
    expect(screen.getByTestId("totals-slip")).toHaveStyle({ opacity: 0.9 });
  });

  it("a compact amount keeps the exact amount in the accessibility label", async () => {
    seed(10 ** 14, "IDR", 10 ** 14);
    await render(<TotalsHeader />);
    const exact = formatMoney(10 ** 14, "IDR", "en");
    expect(screen.getByTestId("slip-amount-month")).not.toHaveTextContent(exact);
    expect(screen.getByTestId("totals-slip").props.accessibilityLabel).toContain(`This month, ${exact}.`);
  });

  it("is a green slip with a yellow total bar under this month and a torn edge", async () => {
    await render(<TotalsHeader />);
    expect(screen.getByTestId("totals-slip")).toHaveStyle({ backgroundColor: lightColors.slip });
    expect(screen.getByTestId("slip-total-bar")).toHaveStyle({ height: 4, backgroundColor: lightColors.highlight });
    expect(screen.getAllByTestId("slip-total-bar")).toHaveLength(1);
    expect(screen.getByTestId("slip-edge", { includeHiddenElements: true })).toBeTruthy();
  });
});

describe("TotalsHeader short window (height < 480)", () => {
  /** Data that makes the full slip show pace, strip and legend. */
  function seedFull() {
    fixToday("2026-11-16T05:00:00Z");
    const cat = listCategories(mockDb)[0].id;
    seedOn("2026-10-10", 1_000_000, cat);
    seedOn("2026-11-05", 1_120_000, cat);
  }

  it("one row: this month and See statistics; no tax year, pace, strip, legend or foot row", async () => {
    seedFull();
    mockLayout = LAYOUTS.duoSideways;
    await render(<TotalsHeader />);
    expect(screen.getByTestId("slip-cell-month")).toBeTruthy();
    const amount = screen.getByTestId("slip-amount-month");
    expect(amount.props.numberOfLines).toBe(1);
    expect(amount.props.adjustsFontSizeToFit).toBe(true);
    expect(within(screen.getByTestId("slip-short-stats")).getByText("See statistics ›")).toBeTruthy();
    for (const id of ["slip-cell-year", "slip-pace", "slip-strip-seg-0", "slip-legend"]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    expect(screen.getAllByText("See statistics ›")).toHaveLength(1);
  });

  it("short window keeps the not-converted note visible", async () => {
    seedOn(formatLocal(new Date(), deviceTimeZone()).slice(0, 10), 400);
    seed(1_000, "USD", null);
    mockLayout = LAYOUTS.duoSideways;
    await render(<TotalsHeader />);
    expect(within(screen.getByTestId("slip-short-stats")).getByText("1 not converted")).toBeTruthy();
  });

  it("short window keeps the full accessibility label", async () => {
    seedFull();
    await render(<TotalsHeader />);
    const full = screen.getByTestId("totals-slip").props.accessibilityLabel;
    await screen.unmount();
    mockLayout = LAYOUTS.duoSideways;
    await render(<TotalsHeader />);
    expect(screen.getByTestId("totals-slip").props.accessibilityLabel).toBe(full);
  });

  it("280 wide with the unconverted note: the money cell has priority and the column texts are capped", async () => {
    seedOn(formatLocal(new Date(), deviceTimeZone()).slice(0, 10), 12_345_678);
    seed(1_000, "USD", null);
    mockLayout = layoutFor({ width: 280, height: 400, left: 0, right: 0 });
    await render(<TotalsHeader />);
    const cell = StyleSheet.flatten(screen.getByTestId("slip-cell-month").props.style);
    expect(cell).toMatchObject({ flexGrow: 3, flexBasis: 0, minWidth: 0 });
    const stats = StyleSheet.flatten(screen.getByTestId("slip-short-stats").props.style);
    expect(stats).toMatchObject({ flexGrow: 2, flexBasis: 0, minWidth: 0 });
    const amount = screen.getByTestId("slip-amount-month");
    expect(amount.props.numberOfLines).toBe(1);
    expect(amount.props.adjustsFontSizeToFit).toBe(true);
    expect(amount.props.minimumFontScale).toBe(0.6);
    for (const text of [within(screen.getByTestId("slip-short-stats")).getByText("1 not converted"), within(screen.getByTestId("slip-short-stats")).getByText("See statistics ›")]) {
      expect(text.props.numberOfLines).toBe(2);
      expect(text.props.adjustsFontSizeToFit).toBe(true);
      expect(text.props.maxFontSizeMultiplier).toBe(1.3);
    }
  });

  it("height 480 is the full slip", async () => {
    mockLayout = layoutFor({ width: 360, height: 480, left: 0, right: 0 });
    await render(<TotalsHeader />);
    expect(screen.getByTestId("slip-cell-year")).toBeTruthy();
    expect(screen.queryByTestId("slip-short-stats")).toBeNull();
  });
});
