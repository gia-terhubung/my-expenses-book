import { renderHook } from "@testing-library/react-native";

import { setPendingSelection, takePendingSelection, usePopToSelection } from "./pendingSelection";

const mockRouter = { back: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
}));

beforeEach(() => {
  takePendingSelection();
  mockRouter.back.mockClear();
  mockRouter.canGoBack.mockReset();
  mockRouter.canGoBack.mockReturnValue(true);
});

describe("pending selection", () => {
  it("take returns the id once, then null", () => {
    setPendingSelection("r1");
    expect(takePendingSelection()).toBe("r1");
    expect(takePendingSelection()).toBeNull();
  });
});

describe("usePopToSelection", () => {
  it("not split: the pushed receipt stays (compact keeps the native push)", async () => {
    await renderHook(() => usePopToSelection("r1", false));
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(takePendingSelection()).toBeNull();
  });

  it("split with history: hands the id over and goes back", async () => {
    await renderHook(() => usePopToSelection("r1", true));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(takePendingSelection()).toBe("r1");
  });

  it("unfold after opening: goes back when split turns true", async () => {
    const h = await renderHook(({ split }: { split: boolean }) => usePopToSelection("r1", split), { initialProps: { split: false } });
    await h.rerender({ split: true });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("goes back once even when re-rendered while split (Review Focus 2)", async () => {
    const h = await renderHook(({ split }: { split: boolean }) => usePopToSelection("r1", split), { initialProps: { split: true } });
    await h.rerender({ split: true });
    await h.rerender({ split: true });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("deep link with nothing beneath: stays", async () => {
    mockRouter.canGoBack.mockReturnValueOnce(false);
    await renderHook(() => usePopToSelection("r1", true));
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(takePendingSelection()).toBeNull();
  });
});
