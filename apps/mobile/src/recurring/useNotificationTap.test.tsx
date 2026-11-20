import { act, renderHook } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import type { ReactNode } from "react";

import { openReview } from "@/capture/useAddReceipt";
import { testDb } from "@/db/testing/testDb";
import { AppObscuredContext } from "@/lock/appObscured";

import { runCatchUp } from "./catchUp";
import { createRule } from "./rules";
import { useNotificationTap } from "./useNotificationTap";

let mockDb: ReturnType<typeof testDb>;
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/capture/useAddReceipt", () => ({ openReview: jest.fn() }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));

const last = Notifications.useLastNotificationResponse as jest.Mock;
// Each response gets its own identifier: "handled" is module-level state shared across tests.
let seq = 0;
const response = (data: object, identifier = `n${++seq}`) => ({
  notification: { date: 1, request: { identifier, content: { data } } },
  actionIdentifier: "default",
});

let obscured = false;
const wrapper = ({ children }: { children: ReactNode }) => (
  <AppObscuredContext.Provider value={obscured}>{children}</AppObscuredContext.Provider>
);

/** A real draft made by catch-up for a draft-type rule due on `date`. */
function draftFor(date: string): { ruleId: string; id: string } {
  const at = new Date(`${date}T05:00:00Z`);
  const rule = createRule(
    mockDb,
    {
      merchant: "Netflix", currency: "IDR", totalMinor: 186000, taxMinor: null, categoryId: null, folderId: null,
      notes: null, frequency: "monthly", anchorDate: date, monthDay: 15, tz: "Asia/Jakarta", autoAdd: false, endDate: null,
    },
    at,
  );
  const { createdIds } = runCatchUp(mockDb, { now: at, home: "IDR", fx: { base: "", latestDate: null, fetchedAt: null, byDate: {} } });
  return { ruleId: rule.id, id: createdIds[0]! };
}

beforeEach(() => {
  mockDb = testDb();
  (openReview as jest.Mock).mockClear();
  last.mockReturnValue(null);
  obscured = false;
});

describe("useNotificationTap", () => {
  it("runs catch-up then opens the draft for the tapped rule and date", async () => {
    const { ruleId, id } = draftFor("2026-03-15");
    last.mockReturnValue(response({ tag: "recurring", ruleId, date: "2026-03-15" }));
    const runNow = jest.fn();
    await renderHook(() => useNotificationTap(runNow), { wrapper });
    expect(runNow).toHaveBeenCalledTimes(1);
    expect(openReview).toHaveBeenCalledWith([id]);
  });

  it("waits while locked and opens once unlocked", async () => {
    const { ruleId, id } = draftFor("2026-03-15");
    last.mockReturnValue(response({ tag: "recurring", ruleId, date: "2026-03-15" }));
    obscured = true;
    const runNow = jest.fn();
    const { rerender } = await renderHook(() => useNotificationTap(runNow), { wrapper });
    expect(openReview).not.toHaveBeenCalled();
    obscured = false;
    await rerender({});
    expect(openReview).toHaveBeenCalledWith([id]);
  });

  it("ignores other notifications and opens nothing when no draft matches", async () => {
    draftFor("2026-03-15");
    last.mockReturnValue(response({ tag: "other" }));
    await renderHook(() => useNotificationTap(jest.fn()), { wrapper });
    last.mockReturnValue(response({ tag: "recurring", ruleId: "r2", date: "2026-03-15" }));
    await renderHook(() => useNotificationTap(jest.fn()), { wrapper });
    expect(openReview).not.toHaveBeenCalled();
  });

  it("retries when opening throws (navigation not ready) and opens on the next attempt", async () => {
    jest.useFakeTimers();
    try {
      const { ruleId, id } = draftFor("2026-03-15");
      last.mockReturnValue(response({ tag: "recurring", ruleId, date: "2026-03-15" }));
      (openReview as jest.Mock).mockImplementationOnce(() => {
        throw new Error("navigation not ready");
      });
      await renderHook(() => useNotificationTap(jest.fn()), { wrapper });
      expect(openReview).toHaveBeenCalledTimes(1);
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(openReview).toHaveBeenCalledTimes(2);
      expect(openReview).toHaveBeenLastCalledWith([id]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not reopen the same response after a remount (unlock)", async () => {
    const { ruleId } = draftFor("2026-03-15");
    const r = response({ tag: "recurring", ruleId, date: "2026-03-15" });
    last.mockReturnValue(r);
    const first = await renderHook(() => useNotificationTap(jest.fn()), { wrapper });
    expect(openReview).toHaveBeenCalledTimes(1);
    await first.unmount();
    await renderHook(() => useNotificationTap(jest.fn()), { wrapper });
    expect(openReview).toHaveBeenCalledTimes(1);
  });
});
