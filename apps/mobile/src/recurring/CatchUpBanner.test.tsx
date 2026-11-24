import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { openReview } from "@/capture/useAddReceipt";
import { getReceipt, updateReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb } from "@/db/types";
import { initI18n } from "@/i18n";
import type { FxCache } from "@/prefs/prefs";

import { CatchUpBanner, REMOVED_MS } from "./CatchUpBanner";
import { runCatchUp, undoCatchUp, type CatchUpResult } from "./catchUp";
import { createRule } from "./rules";

let mockDb: AppDb;
let mockLast: CatchUpResult | null = null;
const mockDismiss = jest.fn(() => {
  mockLast = null;
});
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/capture/useAddReceipt", () => ({ openReview: jest.fn() }));
jest.mock("./useRecurringCatchUp", () => ({ useCatchUpResult: () => ({ last: mockLast, dismiss: mockDismiss }) }));
jest.mock("./catchUp", () => {
  const actual = jest.requireActual("./catchUp");
  return { ...actual, undoCatchUp: jest.fn(actual.undoCatchUp) };
});

const TZ = "Asia/Jakarta";
const fx: FxCache = { base: "idr", latestDate: null, fetchedAt: null, byDate: {} };

/** Three rows from one run: one confirmed (Netflix), two drafts (Electricity, Water). */
function seedRun(): CatchUpResult {
  const base = {
    currency: "IDR",
    totalMinor: 10000000,
    taxMinor: null,
    categoryId: null,
    folderId: null,
    notes: null,
    frequency: "monthly" as const,
    anchorDate: "2026-11-20",
    monthDay: 20,
    tz: TZ,
    endDate: null,
  };
  const at = new Date("2026-11-20T05:00:00Z");
  createRule(mockDb, { ...base, merchant: "Netflix", autoAdd: true }, at);
  createRule(mockDb, { ...base, merchant: "Electricity", autoAdd: false }, at);
  createRule(mockDb, { ...base, merchant: "Water", autoAdd: false }, at);
  return runCatchUp(mockDb, { now: at, home: "IDR", fx });
}

beforeAll(() => initI18n("en"));
beforeEach(() => {
  mockDb = testDb();
  mockLast = null;
  jest.clearAllMocks();
});

describe("CatchUpBanner", () => {
  it("renders nothing when no run added anything", async () => {
    await render(<CatchUpBanner />);
    expect(screen.queryByTestId("catch-up-banner")).toBeNull();
  });

  it("says what was added and how many need confirming", async () => {
    mockLast = seedRun();
    expect(mockLast).toMatchObject({ draftCount: 2 });
    expect(mockLast.createdIds).toHaveLength(3);
    await render(<CatchUpBanner />);
    expect(screen.getByText("Added 3 recurring expenses.")).toBeTruthy();
    expect(screen.getByText("2 need you to confirm the amount.")).toBeTruthy();
    expect(screen.getByTestId("catch-up-review")).toBeTruthy();
  });

  it("Review is the yellow nudge button", async () => {
    mockLast = seedRun();
    await render(<CatchUpBanner />);
    const { StyleSheet } = jest.requireActual("react-native");
    const s = screen.getByTestId("catch-up-review").props.style;
    expect(StyleSheet.flatten(typeof s === "function" ? s({ pressed: false }) : s).backgroundColor).toBe("#FFD84A");
  });

  it("without drafts the second line and Review are left out", async () => {
    mockLast = { createdIds: ["a"], draftCount: 0 };
    await render(<CatchUpBanner />);
    expect(screen.getByText("Added 1 recurring expense.")).toBeTruthy();
    expect(screen.queryByText(/confirm the amount/)).toBeNull();
    expect(screen.queryByTestId("catch-up-review")).toBeNull();
  });

  it("Review opens the first draft of the run, the rest queued", async () => {
    mockLast = seedRun();
    const drafts = mockLast.createdIds.filter((id) => getReceipt(mockDb, id)?.status === "draft");
    await render(<CatchUpBanner />);
    await fireEvent.press(screen.getByTestId("catch-up-review"));
    expect(openReview).toHaveBeenCalledWith(drafts);
    expect(getReceipt(mockDb, drafts[0])?.merchant).toBe("Electricity");
  });

  it("Undo removes the run's rows, then says so for 4 seconds", async () => {
    jest.useFakeTimers();
    try {
      mockLast = seedRun();
      const ids = mockLast.createdIds;
      const view = await render(<CatchUpBanner />);
      await fireEvent.press(screen.getByTestId("catch-up-undo"));
      expect(undoCatchUp).toHaveBeenCalledWith(mockDb, ids);
      for (const id of ids) expect(getReceipt(mockDb, id)?.deletedAt).not.toBeNull();
      expect(mockDismiss).toHaveBeenCalledTimes(1);
      await view.rerender(<CatchUpBanner />);
      expect(screen.getByText("Removed 3 recurring expenses.")).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(REMOVED_MS);
      });
      expect(screen.queryByTestId("catch-up-banner")).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it("Undo keeps rows the user already changed and says so", async () => {
    mockLast = seedRun();
    updateReceipt(mockDb, mockLast.createdIds[0], { notes: "edited" });
    await render(<CatchUpBanner />);
    await fireEvent.press(screen.getByTestId("catch-up-undo"));
    expect(screen.getByText("Removed 2 recurring expenses. Expenses you've already changed were kept.")).toBeTruthy();
  });

  it("Dismiss closes the banner without removing anything", async () => {
    mockLast = seedRun();
    const ids = mockLast.createdIds;
    await render(<CatchUpBanner />);
    await fireEvent.press(screen.getByTestId("catch-up-dismiss"));
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(undoCatchUp).not.toHaveBeenCalled();
    for (const id of ids) expect(getReceipt(mockDb, id)?.deletedAt).toBeNull();
  });
});
