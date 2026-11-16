import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

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
  it("day number never wraps: one line, no shrink, min width", async () => {
    seed("A", "2026-11-16T10:00:00", 100);
    await render(<ReceiptList filter={filter} onSelect={() => {}} empty={empty} />);
    const day = screen.getByText("16");
    expect(day.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(day.props.style)).toMatchObject({ flexShrink: 0, minWidth: 30 });
  });

  it("month header: total shrinks to fit on one line, month name shrinks first", async () => {
    seed("A", "2026-11-03T10:00:00", 100);
    await render(<ReceiptList filter={filter} onSelect={() => {}} empty={empty} />);
    expect(screen.getByTestId("month-total-2026-11").props).toMatchObject({
      numberOfLines: 1,
      adjustsFontSizeToFit: true,
      minimumFontScale: 0.6,
    });
    const name = screen.getByText(/November 2026/);
    expect(StyleSheet.flatten(name.props.style).flexShrink).toBe(1);
  });

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

  it("long merchant truncates, amount stays whole", async () => {
    seed("A very long merchant name that keeps going and going and going", "2026-11-03T10:00:00", 123456789);
    seed("Second", "2026-11-02T10:00:00", 100);
    await render(<ReceiptList filter={filter} onSelect={() => {}} empty={empty} />);
    const merchant = screen.getByText(/A very long merchant/);
    expect(merchant.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(merchant.props.style).flexShrink).toBe(1);
    const amount = screen.getByText(/1,234,568/);
    expect(amount.props.numberOfLines).toBe(1);
    const a = StyleSheet.flatten(amount.props.style);
    expect(a.flexShrink).toBe(0);
    expect(a.fontVariant).toEqual(["tabular-nums"]);
  });

  it("rows after the first in a month have a dashed top border", async () => {
    const a = await seed("A", "2026-11-03T10:00:00", 100);
    const b = await seed("B", "2026-11-01T10:00:00", 200);
    await render(<ReceiptList filter={filter} onSelect={() => {}} empty={empty} />);
    const st = (id: string) => {
      return StyleSheet.flatten(screen.getByTestId(`receipt-row-${id}`).props.style);
    };
    const ids = [a, b].map((r: any) => r?.id ?? r);
    expect(st(ids[0]).borderTopWidth ?? 0).toBe(0);
    expect(st(ids[1])).toMatchObject({ borderTopWidth: 1, borderStyle: "dashed" });
  });
});
