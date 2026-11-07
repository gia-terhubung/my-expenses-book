import { act, renderHook, waitFor } from "@testing-library/react-native";

import { createReceipt, updateReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";

import { useReceiptQuery } from "./useReceiptQuery";

let mockDb: AppDb;
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/prefs/PrefsProvider", () => ({ usePref: () => "IDR" }));

const filter = {};
function seed(i: number, merchant = `M${i}`) {
  const day = String((i % 28) + 1).padStart(2, "0");
  return createReceipt(mockDb, {
    status: "confirmed",
    merchant,
    purchasedAtLocal: `2026-10-${day}T10:00:00`,
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: Date.UTC(2026, 9, +day, 3),
    scannedAtUtc: Date.UTC(2026, 9, 30),
    scannedTz: "Asia/Jakarta",
    currency: "IDR",
    totalMinor: 1000,
    taxMinor: null,
    homeCurrencyAtSave: "IDR",
    amountHomeMinor: 1000,
    parseSource: "manual",
  } as never);
}

beforeEach(() => {
  mockDb = testDb();
});

describe("useReceiptQuery", () => {
  it("pages 50 at a time", async () => {
    for (let i = 0; i < 120; i++) seed(i);
    const { result } = await renderHook(() => useReceiptQuery(filter));
    expect(result.current.rows).toHaveLength(50);
    expect(result.current.hasMore).toBe(true);
    await act(async () => result.current.loadMore());
    expect(result.current.rows).toHaveLength(100);
    await act(async () => result.current.loadMore());
    expect(result.current.rows).toHaveLength(120);
    expect(result.current.hasMore).toBe(false);
  });

  it("refreshes after a write", async () => {
    const r = seed(1, "Old");
    const { result } = await renderHook(() => useReceiptQuery(filter));
    expect(result.current.rows[0].merchant).toBe("Old");
    await act(
      async () => void updateReceipt(mockDb, r.id, { merchant: "New" }),
    );
    await waitFor(() => expect(result.current.rows[0].merchant).toBe("New"));
  });

  it("keeps the loaded window when data changes", async () => {
    for (let i = 0; i < 120; i++) seed(i);
    const { result } = await renderHook(() => useReceiptQuery(filter));
    await act(async () => result.current.loadMore());
    await act(async () => result.current.loadMore());
    expect(result.current.rows).toHaveLength(120);
    const target = result.current.rows[109];
    await act(
      async () => void updateReceipt(mockDb, target.id, { merchant: "Edited" }),
    );
    await waitFor(() =>
      expect(
        result.current.rows.find((r) => r.id === target.id)?.merchant,
      ).toBe("Edited"),
    );
    expect(result.current.rows).toHaveLength(120);
  });
});
