import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { AppState } from "react-native";

import { restoreLease } from "@/backup/restoreLease";
import { AppObscuredContext } from "@/lock/appObscured";

import { runCatchUp } from "./catchUp";
import { useRecurringCatchUp } from "./useRecurringCatchUp";

const mockDb = {};
const mockFx = { base: "idr", latestDate: null, fetchedAt: null, byDate: {} };
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: () => "IDR",
  usePrefs: () => ({ get: () => mockFx }),
}));
jest.mock("./catchUp", () => ({ runCatchUp: jest.fn() }));

const run = runCatchUp as jest.Mock;
type Listener = (s: string) => void;
let listener: Listener | null = null;

beforeEach(() => {
  run.mockReset();
  run.mockReturnValue({ createdIds: [], draftCount: 0 });
  listener = null;
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, cb: Listener) => {
    listener = cb;
    return { remove: jest.fn() };
  }) as never);
});
afterEach(() => jest.restoreAllMocks());

let obscured = false;
const wrapper = ({ children }: { children: ReactNode }) => (
  <AppObscuredContext.Provider value={obscured}>{children}</AppObscuredContext.Provider>
);

describe("useRecurringCatchUp", () => {
  it("runs on mount with the db, home currency and cached FX tables", async () => {
    obscured = false;
    const { unmount } = await renderHook(() => useRecurringCatchUp(), { wrapper });
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(mockDb, { now: expect.any(Date), home: "IDR", fx: mockFx });
    await unmount();
  });

  it("with the restore lease held, mounting runs nothing; releasing the lease runs once", async () => {
    obscured = false;
    const release = restoreLease.acquire();
    const { unmount } = await renderHook(() => useRecurringCatchUp(), { wrapper });
    expect(run).not.toHaveBeenCalled();
    await act(async () => release());
    expect(run).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it("waits while the app is locked and runs once unlocked", async () => {
    obscured = true;
    const { rerender, unmount } = await renderHook(() => useRecurringCatchUp(), { wrapper });
    await act(async () => listener?.("active"));
    expect(run).not.toHaveBeenCalled();
    obscured = false;
    await rerender({});
    expect(run).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it("runs again when the app returns to the foreground", async () => {
    obscured = false;
    const { unmount } = await renderHook(() => useRecurringCatchUp(), { wrapper });
    await act(async () => listener?.("background"));
    expect(run).toHaveBeenCalledTimes(1);
    await act(async () => listener?.("active"));
    expect(run).toHaveBeenCalledTimes(2);
    await unmount();
  });

  it("exposes what a run created until dismissed", async () => {
    obscured = false;
    run.mockReturnValueOnce({ createdIds: ["a", "b"], draftCount: 1 });
    const { result, unmount } = await renderHook(() => useRecurringCatchUp(), { wrapper });
    expect(result.current.last).toEqual({ createdIds: ["a", "b"], draftCount: 1 });
    run.mockReturnValueOnce({ createdIds: ["c"], draftCount: 1 });
    await act(async () => listener?.("active"));
    expect(result.current.last).toEqual({ createdIds: ["a", "b", "c"], draftCount: 2 });
    await act(async () => result.current.dismiss());
    expect(result.current.last).toBeNull();
    await unmount();
  });

  it("a failing run is swallowed and the next run still happens", async () => {
    obscured = false;
    run.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const { unmount } = await renderHook(() => useRecurringCatchUp(), { wrapper });
    await act(async () => listener?.("active"));
    expect(run).toHaveBeenCalledTimes(2);
    await unmount();
  });
});
