import { renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";

import { useSheetTopInset } from "./useSheetTopInset";

let mockTop = 30;
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: mockTop, bottom: 0, left: 0, right: 0 }),
  initialWindowMetrics: { insets: { top: 24, bottom: 0, left: 0, right: 0 }, frame: { x: 0, y: 0, width: 0, height: 0 } },
}));

const original = Platform.OS;
afterEach(() => {
  Platform.OS = original;
  mockTop = 30;
});

describe("useSheetTopInset", () => {
  it("returns the top inset on android (page sheet is full screen there)", async () => {
    Platform.OS = "android";
    const { result } = await renderHook(() => useSheetTopInset());
    expect(result.current).toBe(30);
  });

  it("falls back to the initial window metrics when the context reports 0 on android", async () => {
    Platform.OS = "android";
    mockTop = 0;
    const { result } = await renderHook(() => useSheetTopInset());
    expect(result.current).toBe(24);
  });

  it("returns 0 on ios (the sheet card handles it)", async () => {
    Platform.OS = "ios";
    const { result } = await renderHook(() => useSheetTopInset());
    expect(result.current).toBe(0);
  });
});
