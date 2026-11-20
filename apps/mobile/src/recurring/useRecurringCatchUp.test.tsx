import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { AppState } from "react-native";

import { restoreLease } from "@/backup/restoreLease";
import { AppObscuredContext } from "@/lock/appObscured";

import { deviceTimeZone } from "@/capture/localTime";

import { runCatchUp } from "./catchUp";
import { rescheduleAll } from "./notify";
import { requestCatchUp, useRecurringCatchUp } from "./useRecurringCatchUp";

let mockDb: object = {};
let mockNow = new Date("2026-11-20T05:00:00Z");
jest.mock("@/dates/clock", () => ({ now: () => mockNow }));
const mockFx = { base: "idr", latestDate: null, fetchedAt: null, byDate: {} };
jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: () => "IDR",
  usePrefs: () => ({ get: () => mockFx }),
}));
jest.mock("./catchUp", () => ({ runCatchUp: jest.fn() }));
jest.mock("./notify", () => ({ rescheduleAll: jest.fn(async () => 0) }));
jest.mock("@/capture/localTime", () => ({
  ...jest.requireActual("@/capture/localTime"),
  deviceTimeZone: jest.fn(() => "Asia/Jakarta"),
}));

const run = runCatchUp as jest.Mock;
const reschedule = rescheduleAll as jest.Mock;
const tz = deviceTimeZone as jest.Mock;
type Listener = (s: string) => void;
let listener: Listener | null = null;

beforeEach(() => {
  mockNow = new Date("2026-11-20T05:00:00Z");
  reschedule.mockClear();
  tz.mockReturnValue("Asia/Jakarta");
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

  it("requestCatchUp runs through the mounted hook, and does nothing once it unmounts", async () => {
    obscured = false;
    const { unmount } = await renderHook(() => useRecurringCatchUp(), { wrapper });
    expect(run).toHaveBeenCalledTimes(1);
    await act(async () => requestCatchUp());
    expect(run).toHaveBeenCalledTimes(2);
    await unmount();
    requestCatchUp();
    expect(run).toHaveBeenCalledTimes(2);
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

  it("a restore clears what earlier runs created, so Undo never touches restored rows", async () => {
    obscured = false;
    run.mockReturnValueOnce({ createdIds: ["a"], draftCount: 0 });
    const { result, unmount } = await renderHook(() => useRecurringCatchUp(), { wrapper });
    expect(result.current.last).toEqual({ createdIds: ["a"], draftCount: 0 });
    const release = restoreLease.acquire();
    await act(async () => release());
    expect(result.current.last).toBeNull();
    await act(async () => result.current.dismiss());
    await unmount();
  });

  it("a new database handle (restore, reset) clears what runs on the old one created", async () => {
    obscured = false;
    run.mockReturnValueOnce({ createdIds: ["a"], draftCount: 0 });
    const { result, rerender, unmount } = await renderHook(() => useRecurringCatchUp(), { wrapper });
    expect(result.current.last).toEqual({ createdIds: ["a"], draftCount: 0 });
    mockDb = {};
    run.mockReturnValueOnce({ createdIds: ["b"], draftCount: 1 });
    await rerender({});
    expect(run).toHaveBeenLastCalledWith(mockDb, expect.anything());
    expect(result.current.last).toEqual({ createdIds: ["b"], draftCount: 1 });
    await act(async () => result.current.dismiss());
    await unmount();
  });

  it("a run on a later day drops what earlier days created (no weeks-old Undo)", async () => {
    obscured = false;
    run.mockReturnValueOnce({ createdIds: ["a"], draftCount: 0 });
    const { result, unmount } = await renderHook(() => useRecurringCatchUp(), { wrapper });
    // Same day: added to.
    run.mockReturnValueOnce({ createdIds: ["b"], draftCount: 0 });
    await act(async () => listener?.("active"));
    expect(result.current.last).toEqual({ createdIds: ["a", "b"], draftCount: 0 });
    // Next day in the device zone (Jakarta), nothing new: the banner goes.
    mockNow = new Date("2026-11-20T18:00:00Z");
    await act(async () => listener?.("active"));
    expect(result.current.last).toBeNull();
    // A later day with new rows shows only those.
    run.mockReturnValueOnce({ createdIds: ["c"], draftCount: 1 });
    mockNow = new Date("2026-12-05T05:00:00Z");
    await act(async () => listener?.("active"));
    expect(result.current.last).toEqual({ createdIds: ["c"], draftCount: 1 });
    await act(async () => result.current.dismiss());
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

  it("reschedules notifications after every catch-up run", async () => {
    obscured = false;
    const { unmount } = await renderHook(() => useRecurringCatchUp(), { wrapper });
    await act(async () => {});
    expect(reschedule).toHaveBeenCalledTimes(1);
    await act(async () => listener?.("active"));
    await act(async () => {});
    expect(reschedule).toHaveBeenCalledTimes(2);
    await unmount();
  });

  it("reschedules once more on foreground when the device time zone changed", async () => {
    obscured = false;
    const { unmount } = await renderHook(() => useRecurringCatchUp(), { wrapper });
    await act(async () => {});
    reschedule.mockClear();
    tz.mockReturnValue("America/New_York");
    // Catch-up skipped (restore in progress): only the time zone change reschedules.
    const release = restoreLease.acquire();
    await act(async () => listener?.("active"));
    await act(async () => {});
    expect(reschedule).toHaveBeenCalledTimes(1);
    release();
    await unmount();
  });
});
