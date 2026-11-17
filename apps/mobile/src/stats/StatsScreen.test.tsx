import { fireEvent, render, screen } from "@testing-library/react-native";

import { createFolder } from "@/db/repositories/folders";
import { createReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb, NewReceiptInput } from "@/db/types";
import { i18n, initI18n } from "@/i18n";
import { formatMoney } from "@/money/money";

import { StatsScreen } from "./StatsScreen";

let mockDb: AppDb;
let mockStartMonth = 1;
const mockRouter = { back: jest.fn(), push: jest.fn() };
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => (k === "taxYearStartMonth" ? mockStartMonth : k === "language" ? "en" : "IDR"),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
const mockStart = jest.fn();
jest.mock("@/capture/useAddReceipt", () => ({
  useAddReceipt: () => ({ open: jest.fn(), start: (...a: unknown[]) => mockStart(...a), sheet: null }),
}));
jest.mock("expo-router", () => ({
  router: { back: () => mockRouter.back(), push: (...a: unknown[]) => mockRouter.push(...a) },
}));

function seed(merchant: string, local: string, amount: number, over: Partial<NewReceiptInput> = {}) {
  return createReceipt(mockDb, {
    status: "confirmed",
    merchant,
    purchasedAtLocal: `${local}T10:00:00`,
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: Date.UTC(2026, 10, 1),
    scannedAtUtc: Date.UTC(2026, 10, 1),
    currency: "IDR",
    totalMinor: amount,
    homeCurrencyAtSave: "IDR",
    amountHomeMinor: amount,
    parseSource: "manual",
    ...over,
  });
}

/** A foreign receipt without a rate: counted, never in the home total. */
function seedUnconverted(local: string) {
  return seed("Foreign Shop", local, 0, { currency: "USD", totalMinor: 1500, amountHomeMinor: null });
}

const money = (minor: number) => formatMoney(minor, "IDR", "en");
const now = () => new Date(2026, 10, 16, 12);

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
  mockStartMonth = 1;
  jest.clearAllMocks();
});

describe("StatsScreen", () => {
  it("Bulan shows period total, 6 month bars, categories, merchants", async () => {
    const trip = createFolder(mockDb, { name: "Demo Trip Bali", kind: "trip" });
    seed("Harbor Hotel", "2026-11-03", 300000, { categoryId: "default:lodging", folderId: trip.id });
    seed("Bluebird Cab", "2026-11-10", 200000, { categoryId: "default:transport" });
    seed("Bluebird Cab", "2026-10-05", 100000, { categoryId: "default:transport" });
    seed("Late October", "2026-10-25", 900000, { categoryId: "default:transport" });
    await render(<StatsScreen now={now} />);

    expect(screen.getByText("Statistics")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Month" }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText("November 2026")).toBeTruthy();
    expect(screen.getByText("in progress, to day 16")).toBeTruthy();
    expect(screen.getByTestId("stats-total").props.children).toBe(money(500000));
    // Compared with October 1-16 (100,000), not the whole of October.
    expect(screen.getByTestId("stats-pace")).toHaveTextContent(/▲ 400% vs October to day 16/);

    expect(screen.getByText("Last 6 months")).toBeTruthy();
    const bars = screen.getAllByTestId(/^month-bar-\d{4}-\d{2}$/).map((b) => b.props.testID);
    expect(bars).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"].map((m) => `month-bar-${m}`));
    // The gap on October marks the compared day.
    expect(screen.getByTestId("month-bar-gap-2026-10")).toBeTruthy();
    // Only the running month is marked "to <day>".
    expect(screen.getAllByText("to 16")).toHaveLength(1);
    expect(screen.getByTestId("month-bar-2026-11")).toHaveTextContent(/to 16/);
    expect(screen.getByTestId("stats-count")).toHaveTextContent("2 receipts");

    expect(screen.getByText("Categories")).toBeTruthy();
    expect(screen.getByText("Lodging")).toBeTruthy();
    expect(screen.getByText("60%")).toBeTruthy();
    expect(screen.getByText("Transport")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();

    expect(screen.getByText("Top merchants")).toBeTruthy();
    expect(screen.getByText("Harbor Hotel")).toBeTruthy();
    expect(screen.getByText("Bluebird Cab")).toBeTruthy();
    // October's merchant is not in November.
    expect(screen.queryByText("Late October")).toBeNull();

    expect(screen.getByText("Trips & projects")).toBeTruthy();
    expect(screen.getByText("Demo Trip Bali")).toBeTruthy();
    expect(screen.getByText("Trip, 1 receipt")).toBeTruthy();
  });

  it("Tahun pajak with start month 4 shows 12 bars from April", async () => {
    mockStartMonth = 4;
    seed("Spring Shop", "2026-04-02", 100000);
    seed("Before Year", "2026-03-30", 700000);
    seed("Now Shop", "2026-11-02", 50000);
    await render(<StatsScreen now={now} />);
    await fireEvent.press(screen.getByRole("tab", { name: "Tax year" }));

    expect(screen.getByRole("tab", { name: "Tax year" }).props.accessibilityState.selected).toBe(true);
    const bars = screen.getAllByTestId(/^month-bar-\d{4}-\d{2}$/).map((b) => b.props.testID);
    expect(bars).toHaveLength(12);
    expect(bars[0]).toBe("month-bar-2026-04");
    expect(bars[11]).toBe("month-bar-2027-03");
    expect(screen.getByText("By month")).toBeTruthy();
    expect(screen.queryByText("Last 6 months")).toBeNull();
    expect(screen.getByTestId("stats-count")).toHaveTextContent("2 receipts");
    expect(screen.getByTestId("stats-total").props.children).toBe(money(150000));
    expect(screen.queryByText("Before Year")).toBeNull();
    expect(screen.getByText("Spring Shop")).toBeTruthy();
  });

  it("Tahun pajak pace line compares with the previous tax year to the same date", async () => {
    seed("Last Year", "2025-02-10", 100000);
    seed("Last Year Late", "2025-12-01", 900000);
    seed("This Year", "2026-03-01", 150000);
    await render(<StatsScreen now={now} />);
    await fireEvent.press(screen.getByRole("tab", { name: "Tax year" }));
    expect(screen.getByTestId("stats-pace")).toHaveTextContent(/^▲ 50% vs 2025 to Nov 16 \(/);
    expect(screen.getByTestId("stats-pace")).not.toHaveTextContent(/to day/);
  });

  it("receipt count uses the singular for one receipt", async () => {
    seed("Only Shop", "2026-11-02", 50000);
    await render(<StatsScreen now={now} />);
    expect(screen.getByTestId("stats-count")).toHaveTextContent("1 receipt");
  });

  it("bar labels are compact on a runtime that ignores Intl compact notation (Hermes)", async () => {
    seed("Big Month", "2026-11-02", 1205389900);
    seed("Big Year", "2026-04-02", 1205389900);
    const Real = Intl.NumberFormat;
    // Hermes accepts `notation: "compact"`, echoes it in resolvedOptions, and prints the full amount.
    const spy = jest.spyOn(Intl, "NumberFormat").mockImplementation(((locale: string, opts?: Intl.NumberFormatOptions) => {
      if (!opts?.notation) return new Real(locale, opts);
      const full = new Real(locale, { ...opts, notation: undefined });
      return {
        format: (n: number) => full.format(n),
        formatToParts: (n: number) => full.formatToParts(n),
        resolvedOptions: () => ({ ...full.resolvedOptions(), notation: opts.notation }),
      };
    }) as unknown as typeof Intl.NumberFormat);
    i18n.changeLanguage("id");
    try {
      await render(<StatsScreen now={now} />);
      const month = screen.getByTestId("month-bar-2026-11");
      expect(month).toHaveTextContent(/Rp 12,1 jt/);
      expect(month).not.toHaveTextContent(/12\.053\.899|,6/);
      await fireEvent.press(screen.getByRole("tab", { name: "Tahun pajak" }));
      const year = screen.getByTestId("month-bar-2026-04");
      expect(year).toHaveTextContent(/^12,1 jt/);
      expect(year).not.toHaveTextContent(/Rp|12\.053\.899|,6/);
    } finally {
      i18n.changeLanguage("en");
      spy.mockRestore();
    }
  });

  it("pace line hidden when last month has no converted total", async () => {
    seed("Now Shop", "2026-11-02", 50000);
    seedUnconverted("2026-10-03");
    await render(<StatsScreen now={now} />);
    expect(screen.getByTestId("stats-total").props.children).toBe(money(50000));
    expect(screen.queryByTestId("stats-pace")).toBeNull();
  });

  it("unconverted card shows count and Lihat struk opens search with unconverted=1", async () => {
    seed("Now Shop", "2026-11-02", 50000);
    seedUnconverted("2026-11-04");
    seedUnconverted("2026-11-05");
    await render(<StatsScreen now={now} />);

    expect(screen.getByText("Not converted")).toBeTruthy();
    expect(screen.getByText("2 receipts are not in the total.")).toBeTruthy();
    await fireEvent.press(screen.getByRole("link", { name: "See receipts" }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/search", params: { unconverted: "1" } });
  });

  it("sparse state hides folders and unconverted sections", async () => {
    seed("Indomaret Sample", "2026-11-14", 212000, { categoryId: "default:groceries" });
    await render(<StatsScreen now={now} />);

    expect(screen.getByText("Indomaret Sample")).toBeTruthy();
    expect(screen.queryByTestId("stats-pace")).toBeNull();
    expect(screen.queryByText("Trips & projects")).toBeNull();
    expect(screen.queryByText("Not converted")).toBeNull();
    expect(screen.queryByText("See receipts")).toBeNull();
  });

  it("uncategorized and Lainnya are separate rows", async () => {
    seed("No Cat Shop", "2026-11-02", 30000, { categoryId: null });
    seed("Other Shop", "2026-11-03", 70000, { categoryId: "default:other" });
    await render(<StatsScreen now={now} />);

    expect(screen.getByText("No category")).toBeTruthy();
    expect(screen.getByText("30%")).toBeTruthy();
    expect(screen.getByText("Other")).toBeTruthy();
    expect(screen.getByText("70%")).toBeTruthy();
  });

  it("shows the empty message with a scan button when there are no receipts, and goes back", async () => {
    await render(<StatsScreen now={now} />);
    expect(screen.getByText("Statistics appear after a few receipts.")).toBeTruthy();
    expect(screen.queryByText("Categories")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Scan receipt" }));
    expect(mockStart).toHaveBeenCalledWith("scan");
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
