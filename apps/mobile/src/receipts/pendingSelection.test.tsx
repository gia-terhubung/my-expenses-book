import { renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { AppObscuredContext } from "@/lock/appObscured";

import { setPendingSelection, takePendingSelection, usePopToSelection } from "./pendingSelection";

const mockNav = { goBack: jest.fn(), canGoBack: jest.fn(() => true) };
let mockFocused = true;
jest.mock("expo-router", () => ({
  useNavigation: () => mockNav,
  useIsFocused: () => mockFocused,
}));

let frames: (() => void)[] = [];
const flushFrame = () => {
  const run = frames;
  frames = [];
  run.forEach((f) => f());
};

beforeEach(() => {
  takePendingSelection();
  mockNav.goBack.mockClear();
  mockNav.canGoBack.mockReset();
  mockNav.canGoBack.mockReturnValue(true);
  mockFocused = true;
  frames = [];
  let n = 0;
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
    const id = ++n;
    frames[id - 1] = () => cb(0);
    return id;
  });
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id?: number | null) => {
    if (id) delete frames[id - 1];
  });
});
afterEach(() => jest.restoreAllMocks());

const obscuredWrapper = (obscured: boolean) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <AppObscuredContext.Provider value={obscured}>{children}</AppObscuredContext.Provider>;
  };

describe("pending selection", () => {
  it("take returns the id once, then null", () => {
    setPendingSelection("r1");
    expect(takePendingSelection()).toBe("r1");
    expect(takePendingSelection()).toBeNull();
  });
});

describe("usePopToSelection", () => {
  it("not split: the pushed receipt stays (compact keeps the native push)", async () => {
    await renderHook(() => usePopToSelection("r1", false, true));
    flushFrame();
    expect(mockNav.goBack).not.toHaveBeenCalled();
    expect(takePendingSelection()).toBeNull();
  });

  it("split, focused, unobscured: pops once on the next frame and the id lands", async () => {
    await renderHook(() => usePopToSelection("r1", true, true));
    expect(mockNav.goBack).not.toHaveBeenCalled();
    flushFrame();
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
    expect(takePendingSelection()).toBe("r1");
  });

  it("unfold after opening: goes back when split turns true", async () => {
    const h = await renderHook(({ split }: { split: boolean }) => usePopToSelection("r1", split, true), { initialProps: { split: false } });
    await h.rerender({ split: true });
    flushFrame();
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it("goes back once even when re-rendered while split", async () => {
    const h = await renderHook(({ split }: { split: boolean }) => usePopToSelection("r1", split, true), { initialProps: { split: true } });
    flushFrame();
    await h.rerender({ split: true });
    flushFrame();
    await h.rerender({ split: true });
    flushFrame();
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it("lock screen on top (obscured, unfocused): no pop", async () => {
    mockFocused = false;
    await renderHook(() => usePopToSelection("r1", true, true), { wrapper: obscuredWrapper(true) });
    flushFrame();
    expect(mockNav.goBack).not.toHaveBeenCalled();
    expect(takePendingSelection()).toBeNull();
  });

  it("edit modal on top (unfocused): no pop", async () => {
    mockFocused = false;
    await renderHook(() => usePopToSelection("r1", true, true));
    flushFrame();
    expect(mockNav.goBack).not.toHaveBeenCalled();
  });

  it("obscured but focused: no pop", async () => {
    await renderHook(() => usePopToSelection("r1", true, true), { wrapper: obscuredWrapper(true) });
    flushFrame();
    expect(mockNav.goBack).not.toHaveBeenCalled();
  });

  it("pops after the screen regains focus (not latched early)", async () => {
    mockFocused = false;
    const h = await renderHook(() => usePopToSelection("r1", true, true));
    flushFrame();
    mockFocused = true;
    await h.rerender({});
    flushFrame();
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it("split flips back within the frame: no pop", async () => {
    const h = await renderHook(({ split }: { split: boolean }) => usePopToSelection("r1", split, true), { initialProps: { split: true } });
    await h.rerender({ split: false });
    flushFrame();
    expect(mockNav.goBack).not.toHaveBeenCalled();
  });

  it("pushed without from=list on split: no pop, no pending id", async () => {
    setPendingSelection("stale");
    await renderHook(() => usePopToSelection("r1", true, false));
    flushFrame();
    expect(mockNav.goBack).not.toHaveBeenCalled();
    expect(takePendingSelection()).toBeNull();
  });

  it("unmount without popping clears the pending slot", async () => {
    mockFocused = false;
    const h = await renderHook(() => usePopToSelection("r1", true, true));
    setPendingSelection("r1");
    await h.unmount();
    expect(takePendingSelection()).toBeNull();
  });

  it("unmount after popping keeps the id for the list", async () => {
    const h = await renderHook(() => usePopToSelection("r1", true, true));
    flushFrame();
    await h.unmount();
    expect(takePendingSelection()).toBe("r1");
  });

  it("deep link with nothing beneath: stays", async () => {
    mockNav.canGoBack.mockReturnValue(false);
    await renderHook(() => usePopToSelection("r1", true, true));
    flushFrame();
    expect(mockNav.goBack).not.toHaveBeenCalled();
    expect(takePendingSelection()).toBeNull();
  });
});
