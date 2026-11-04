import { act, renderHook } from "@testing-library/react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { AppState } from "react-native";

import { useWindowClass } from "@/layout/useWindowClass";

import { useLockGate } from "./useLockGate";

jest.mock("expo-local-authentication", () => ({
  authenticateAsync: jest.fn(),
  getEnrolledLevelAsync: jest.fn(),
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
}));

let mockPrefs: Record<string, unknown> = {};
jest.mock("@/prefs/PrefsProvider", () => ({
  usePref: (k: string) => mockPrefs[k],
}));

jest.mock("@/layout/useWindowClass", () => ({ useWindowClass: jest.fn() }));

type Listener = (s: string) => void;
let listener: Listener | null = null;
const remove = jest.fn();
const auth = LocalAuthentication.authenticateAsync as jest.Mock;
const level = LocalAuthentication.getEnrolledLevelAsync as jest.Mock;
let now = 1_000_000;

beforeEach(() => {
  mockPrefs = { lockEnabled: true, lockTimeout: 60 };
  listener = null;
  now = 1_000_000;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  jest.spyOn(AppState, "addEventListener").mockImplementation(((
    _: string,
    cb: Listener,
  ) => {
    listener = cb;
    return { remove };
  }) as never);
  (useWindowClass as jest.Mock).mockReturnValue("compact");
  auth.mockReset();
  level.mockReset();
});
afterEach(() => jest.restoreAllMocks());

const send = (s: string) => act(async () => listener?.(s));

describe("useLockGate", () => {
  it("is locked on cold start when enabled", async () => {
    const { result } = await renderHook(() => useLockGate());
    expect(result.current.locked).toBe(true);
  });

  it("is unlocked on cold start when disabled", async () => {
    mockPrefs.lockEnabled = false;
    const { result } = await renderHook(() => useLockGate());
    expect(result.current.locked).toBe(false);
  });

  it("unlock() success clears lock; failure keeps it", async () => {
    const { result } = await renderHook(() => useLockGate());
    auth.mockResolvedValueOnce({ success: false, error: "user_cancel" });
    await act(async () => {
      expect(await result.current.unlock()).toBe(false);
    });
    expect(result.current.locked).toBe(true);
    auth.mockResolvedValueOnce({ success: true });
    await act(async () => {
      expect(await result.current.unlock()).toBe(true);
    });
    expect(result.current.locked).toBe(false);
    expect(auth.mock.calls[0][0]).toMatchObject({
      disableDeviceFallback: false,
    });
  });

  it("never locks the user out when no passcode/biometric exists", async () => {
    const { result } = await renderHook(() => useLockGate());
    auth.mockResolvedValueOnce({ success: false, error: "passcode_not_set" });
    await act(async () => {
      await result.current.unlock();
    });
    expect(result.current.locked).toBe(false);
  });

  it("not_available fails open only if level is NONE", async () => {
    level.mockResolvedValue(0);
    const a = await renderHook(() => useLockGate());
    auth.mockResolvedValueOnce({ success: false, error: "not_available" });
    await act(async () => {
      await a.result.current.unlock();
    });
    expect(a.result.current.locked).toBe(false);

    level.mockResolvedValue(3);
    const b = await renderHook(() => useLockGate());
    auth.mockResolvedValueOnce({ success: false, error: "not_available" });
    await act(async () => {
      await b.result.current.unlock();
    });
    expect(b.result.current.locked).toBe(true);
  });

  async function unlocked() {
    const hook = await renderHook(() => useLockGate());
    auth.mockResolvedValueOnce({ success: true });
    await act(async () => {
      await hook.result.current.unlock();
    });
    expect(hook.result.current.locked).toBe(false);
    return hook;
  }

  it("dimension change does not lock", async () => {
    const hook = await unlocked();
    (useWindowClass as jest.Mock).mockReturnValue("expanded");
    await hook.rerender({});
    expect(hook.result.current.locked).toBe(false);
  });

  it("inactive -> active does not lock", async () => {
    const { result } = await unlocked();
    now += 10 * 60_000;
    await send("inactive");
    now += 10 * 60_000;
    await send("active");
    expect(result.current.locked).toBe(false);
  });

  it("background 61s -> active locks (through inactive hops)", async () => {
    const { result } = await unlocked();
    await send("inactive");
    await send("background");
    now += 61_000;
    await send("inactive");
    await send("active");
    expect(result.current.locked).toBe(true);
  });

  it("background 30s -> active does not lock", async () => {
    const { result } = await unlocked();
    await send("background");
    now += 30_000;
    await send("active");
    expect(result.current.locked).toBe(false);
  });

  it("removes the AppState listener on unmount", async () => {
    const { unmount } = await renderHook(() => useLockGate());
    await unmount();
    expect(remove).toHaveBeenCalled();
  });

  it("background during an in-flight unlock does not re-lock (PIN fallback)", async () => {
    mockPrefs.lockTimeout = 0;
    const { result } = await renderHook(() => useLockGate());
    let resolve!: (v: unknown) => void;
    auth.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    let p!: Promise<boolean>;
    await act(async () => {
      p = result.current.unlock();
    });
    await send("background");
    now += 5000;
    await send("active");
    await act(async () => {
      resolve({ success: true });
      await p;
    });
    expect(result.current.locked).toBe(false);
    expect(auth).toHaveBeenCalledTimes(1);
  });

  it("timeout 0: locked immediately on background", async () => {
    mockPrefs.lockTimeout = 0;
    const { result } = await unlocked();
    await send("inactive");
    expect(result.current.locked).toBe(false);
    await send("background");
    expect(result.current.locked).toBe(true);
  });

  it("timeout 60: covered on background, uncovered on quick return", async () => {
    const { result } = await unlocked();
    await send("inactive");
    expect(result.current.covered).toBe(false);
    await send("background");
    expect(result.current.covered).toBe(true);
    expect(result.current.locked).toBe(false);
    now += 5000;
    await send("active");
    expect(result.current.covered).toBe(false);
    expect(result.current.locked).toBe(false);
  });

  it("timeout 60: long background -> locked on active, cover dropped", async () => {
    const { result } = await unlocked();
    await send("background");
    now += 61_000;
    await send("active");
    expect(result.current.locked).toBe(true);
    expect(result.current.covered).toBe(false);
  });
});
