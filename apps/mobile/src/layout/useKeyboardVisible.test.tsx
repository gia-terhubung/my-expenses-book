import { act, renderHook } from "@testing-library/react-native";
import { Keyboard, Platform } from "react-native";

import { useKeyboardVisible } from "./useKeyboardVisible";

type Cb = () => void;
let listeners: Record<string, Cb>;
const removed: string[] = [];
const original = Platform.OS;

beforeEach(() => {
  listeners = {};
  removed.length = 0;
  jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: Cb) => {
    listeners[event] = cb;
    return { remove: () => removed.push(event) };
  }) as never);
});
afterEach(() => {
  Platform.OS = original;
  jest.restoreAllMocks();
});

describe("useKeyboardVisible", () => {
  it("iOS: follows keyboardWillShow / keyboardWillHide", async () => {
    Platform.OS = "ios";
    const { result, unmount } = await renderHook(() => useKeyboardVisible());
    expect(result.current).toBe(false);
    await act(async () => listeners.keyboardWillShow());
    expect(result.current).toBe(true);
    await act(async () => listeners.keyboardWillHide());
    expect(result.current).toBe(false);
    await unmount();
    expect(removed.sort()).toEqual(["keyboardWillHide", "keyboardWillShow"]);
  });

  it("Android: follows keyboardDidShow / keyboardDidHide (no will-events there)", async () => {
    Platform.OS = "android";
    const { result } = await renderHook(() => useKeyboardVisible());
    await act(async () => listeners.keyboardDidShow());
    expect(result.current).toBe(true);
    await act(async () => listeners.keyboardDidHide());
    expect(result.current).toBe(false);
  });
});
