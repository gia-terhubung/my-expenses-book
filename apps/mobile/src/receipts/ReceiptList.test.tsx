import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { createReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";

import { ReceiptList } from "./ReceiptList";

let mockDb: AppDb;
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/prefs/PrefsProvider", () => ({ usePref: () => "IDR" }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const filter = {};
function seed(merchant: string, local: string, minor: number) {
  return createReceipt(mockDb, {
    status: "confirmed",
    merchant,
    purchasedAtLocal: local,
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: Date.UTC(2026, 0, 1),
    scannedAtUtc: Date.UTC(2026, 0, 1),
    scannedTz: "Asia/Jakarta",
    currency: "IDR",
    totalMinor: minor,
    taxMinor: null,
    homeCurrencyAtSave: "IDR",
    amountHomeMinor: minor,
    parseSource: "manual",
  } as never);
}

beforeEach(() => {
  mockDb = testDb();
});

const empty = <Text>nothing here</Text>;

describe("ReceiptList", () => {
  it("one header per month with month totals", async () => {
    seed("A", "2026-11-03T10:00:00", 100);
    seed("B", "2026-11-01T10:00:00", 200);
    seed("C", "2026-10-20T10:00:00", 500);
    await render(
      <ReceiptList filter={filter} onSelect={() => {}} empty={empty} />,
    );
    expect(screen.getAllByRole("header")).toHaveLength(2);
    expect(screen.getByText(/November 2026/)).toBeTruthy();
    expect(screen.getByText(/October 2026/)).toBeTruthy();
    expect(screen.getByTestId("month-total-2026-11").props.children).toContain(
      "3",
    );
    expect(screen.getByTestId("month-total-2026-10").props.children).toContain(
      "5",
    );
  });

  it("press selects, selected flagged", async () => {
    const a = seed("Alpha", "2026-11-03T10:00:00", 100);
    seed("Beta", "2026-11-02T10:00:00", 100);
    const onSelect = jest.fn();
    await render(
      <ReceiptList
        filter={filter}
        selectedId={a.id}
        onSelect={onSelect}
        empty={empty}
      />,
    );
    fireEvent.press(screen.getByText("Beta"));
    expect(onSelect).toHaveBeenCalledWith(expect.any(String));
    expect(
      screen.getByTestId(`receipt-row-${a.id}`).props.accessibilityState
        .selected,
    ).toBe(true);
  });

  it("shows empty element", async () => {
    await render(
      <ReceiptList filter={filter} onSelect={() => {}} empty={empty} />,
    );
    expect(screen.getByText("nothing here")).toBeTruthy();
  });
});
