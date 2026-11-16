import { render, screen, within } from "@testing-library/react-native";

import { deviceTimeZone, formatLocal } from "@/capture/localTime";
import { createReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n } from "@/i18n";
import { formatMoney } from "@/money/money";
import { lightColors } from "@/theme/tokens";

import { TotalsHeader } from "./TotalsHeader";

let mockDb: AppDb;
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => ({ homeCurrency: "IDR", taxYearStartMonth: 1 })[k],
}));

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

  it("cell accessibility label keeps the combined totalLine text", async () => {
    seed(50_000, "IDR", 50_000);
    seed(1_000, "USD", null);
    await render(<TotalsHeader />);
    const money = formatMoney(50_000, "IDR", "en");
    expect(screen.getByTestId("slip-cell-month").props.accessibilityLabel).toBe(`This month, ${money} · 1 not converted`);
    expect(screen.getByTestId("slip-cell-month").props.accessible).toBe(true);
    expect(within(screen.getByTestId("slip-cell-month")).getByText("1 not converted")).toBeTruthy();
  });

  it("a compact amount keeps the exact amount in the accessibility label", async () => {
    seed(10 ** 14, "IDR", 10 ** 14);
    await render(<TotalsHeader />);
    const exact = formatMoney(10 ** 14, "IDR", "en");
    expect(screen.getByTestId("slip-amount-month")).not.toHaveTextContent(exact);
    expect(screen.getByTestId("slip-cell-month").props.accessibilityLabel).toBe(`This month, ${exact}`);
  });

  it("is a green slip with a yellow total bar under this month and a torn edge", async () => {
    await render(<TotalsHeader />);
    expect(screen.getByTestId("totals-slip")).toHaveStyle({ backgroundColor: lightColors.slip });
    expect(screen.getByTestId("slip-total-bar")).toHaveStyle({ height: 4, backgroundColor: lightColors.highlight });
    expect(screen.getAllByTestId("slip-total-bar")).toHaveLength(1);
    expect(screen.getByTestId("slip-edge", { includeHiddenElements: true })).toBeTruthy();
  });
});
