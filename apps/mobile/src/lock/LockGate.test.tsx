import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useState } from "react";
import { AppState, Pressable, Text, useWindowDimensions } from "react-native";

import { initI18n } from "@/i18n";

import { LockGate } from "./LockGate";

jest.mock("expo-local-authentication", () => ({
  authenticateAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(),
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
}));
let mockTimeout = 60;
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => ({ lockEnabled: true, lockTimeout: mockTimeout })[k],
}));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const auth = LocalAuthentication.authenticateAsync as jest.Mock;
const dims = useWindowDimensions as jest.Mock;
const setWidth = (width: number) =>
  dims.mockReturnValue({ width, height: 800, scale: 2, fontScale: 1 });

function Counter() {
  const [n, setN] = useState(0);
  const { width } = useWindowDimensions();
  return (
    <Pressable onPress={() => setN(n + 1)}>
      <Text>{`count ${n} w ${width}`}</Text>
    </Pressable>
  );
}

const listener = { current: null as ((s: string) => void) | null };

beforeAll(() => initI18n("en"));

beforeEach(() => {
  mockTimeout = 60;
  auth.mockReset();
  setWidth(400);
  listener.current = null;
  jest.spyOn(AppState, "addEventListener").mockImplementation(((
    _: string,
    cb: (s: string) => void,
  ) => {
    listener.current = cb;
    return { remove: jest.fn() };
  }) as never);
});
afterEach(() => jest.restoreAllMocks());

describe("LockGate", () => {
  it("shows the overlay on first render and prompts once; failure does not loop", async () => {
    auth.mockResolvedValue({ success: false, error: "user_cancel" });
    await render(
      <LockGate>
        <Counter />
      </LockGate>,
    );
    expect(screen.getByTestId("lock-screen")).toBeTruthy();
    await act(async () => {});
    expect(auth).toHaveBeenCalledTimes(1);

    auth.mockResolvedValueOnce({ success: false, error: "user_cancel" });
    await fireEvent.press(screen.getByText("Unlock"));
    expect(auth).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Try again")).toBeTruthy();
    await act(async () => {});
    expect(auth).toHaveBeenCalledTimes(2);
  });

  it("keeps child state while locked and after unlock; dimension change adds no prompt", async () => {
    auth.mockResolvedValueOnce({ success: false, error: "user_cancel" });
    const ui = () => (
      <LockGate>
        <Counter />
      </LockGate>
    );
    const r = await render(ui());
    await act(async () => {});
    await fireEvent.press(
      screen.getByText("count 0 w 400", { includeHiddenElements: true }),
    );
    expect(
      screen.getByText("count 1 w 400", { includeHiddenElements: true }),
    ).toBeTruthy();

    auth.mockResolvedValueOnce({ success: true });
    await fireEvent.press(screen.getByText("Unlock"));
    expect(screen.queryByTestId("lock-screen")).toBeNull();
    expect(
      screen.getByText("count 1 w 400", { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(auth).toHaveBeenCalledTimes(2);

    setWidth(900);
    await r.rerender(ui());
    expect(screen.getByText("count 1 w 900")).toBeTruthy();
    expect(screen.queryByTestId("lock-screen")).toBeNull();
    expect(auth).toHaveBeenCalledTimes(2);
  });

  it("timeout 0: no prompt while backgrounded; exactly one on active", async () => {
    mockTimeout = 0;
    auth.mockResolvedValueOnce({ success: true });
    await render(
      <LockGate>
        <Counter />
      </LockGate>,
    );
    await act(async () => {});
    expect(auth).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("lock-screen")).toBeNull();

    await act(async () => listener.current?.("background"));
    expect(screen.getByTestId("lock-screen")).toBeTruthy();
    expect(auth).toHaveBeenCalledTimes(1);

    auth.mockResolvedValueOnce({ success: false, error: "user_cancel" });
    await act(async () => listener.current?.("active"));
    expect(auth).toHaveBeenCalledTimes(2);
  });

  it("failure while active, then rerender, makes no second call", async () => {
    auth.mockResolvedValue({ success: false, error: "user_cancel" });
    const r = await render(
      <LockGate>
        <Counter />
      </LockGate>,
    );
    await act(async () => {});
    await act(async () => listener.current?.("inactive"));
    await act(async () => listener.current?.("active"));
    await r.rerender(
      <LockGate>
        <Counter />
      </LockGate>,
    );
    expect(auth).toHaveBeenCalledTimes(1);
  });
});
