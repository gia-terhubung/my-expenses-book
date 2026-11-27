import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useLayoutEffect, useState } from "react";
import {
  AppState,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
} from "react-native";

import { initI18n } from "@/i18n";

import { LockGate, LockRoute } from "./LockGate";

// Route-based lock: the mocked router "presents" /lock by mounting <LockRoute/> beside the gate,
// as the root Stack would. The root state lists the routes; a keyed POP of the lock route
// removes it. `above` = routes pushed after /lock (e.g. the capture modal).
const mockRoute = {
  setShown: null as ((v: boolean) => void) | null,
  hold: false,
  routes: ["(tabs)"] as string[],
  seq: 0,
};
const mockRouter = { push: jest.fn(), dismiss: jest.fn(), replace: jest.fn(), dispatch: jest.fn() };
const mockKey = (name: string) => (name === "lock" ? `lock-${mockRoute.seq}` : `${name}-k`);
jest.mock("expo-router", () => ({
  ...jest.requireActual("../../test/expoRouterStack").stackMock,
  useRootNavigationState: () => ({ key: "root" }),
  useNavigationContainerRef: () => ({
    getRootState: () => ({
      key: "root",
      index: mockRoute.routes.length - 1,
      routes: mockRoute.routes.map((name) => ({ name, key: mockKey(name) })),
    }),
    dispatch: (a: { type: string; source?: string }) => {
      mockRouter.dispatch(a);
      if (a.type === "POP" && a.source === mockKey("lock")) {
        mockRoute.routes = mockRoute.routes.filter((n) => n !== "lock");
        mockRoute.setShown?.(false);
      }
    },
  }),
  router: {
    push: (...a: unknown[]) => {
      mockRouter.push(...a);
      if (a[0] === "/lock") {
        mockRoute.seq++;
        mockRoute.routes = [...mockRoute.routes, "lock"];
      } else mockRoute.routes = [...mockRoute.routes, String(a[0])];
      if (!mockRoute.hold) mockRoute.setShown?.(true);
    },
    replace: (...a: unknown[]) => mockRouter.replace(...a),
    dismiss: (...a: unknown[]) => {
      mockRouter.dismiss(...a);
      mockRoute.routes = mockRoute.routes.slice(0, -1);
    },
  },
}));
jest.mock("./snapshotProtection", () => ({
  applySnapshotProtection: jest.fn().mockResolvedValue(undefined),
}));

function Host({ children, initiallyShown = false }: { children: React.ReactNode; initiallyShown?: boolean }) {
  const [shown, setShown] = useState(initiallyShown);
  useLayoutEffect(() => {
    mockRoute.setShown = setShown;
  }, []);
  return (
    <LockGate>
      {children}
      {shown ? <LockRoute /> : null}
    </LockGate>
  );
}

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
  mockRouter.push.mockReset();
  mockRouter.dismiss.mockReset();
  mockRouter.replace.mockReset();
  mockRouter.dispatch.mockReset();
  mockRoute.routes = ["(tabs)"];
  mockRoute.seq = 0;
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
  it("privacy cover is separate from lock: covered only when not locked; lock cover clears once /lock mounts", async () => {
    mockTimeout = 600;
    auth.mockResolvedValueOnce({ success: false, error: "user_cancel" });
    await render(
      <Host>
        <Counter />
      </Host>,
    );
    await act(async () => {});
    // /lock mounted (mock router) -> cold-start cover gone, lock UI reachable, no privacy cover.
    expect(screen.queryByTestId("lock-pending-cover")).toBeNull();
    expect(screen.queryByTestId("privacy-cover")).toBeNull();
    expect(screen.getByTestId("lock-screen")).toBeTruthy();
  });

  it("cold start covers content until /lock mounts", async () => {
    auth.mockResolvedValue({ success: false, error: "user_cancel" });
    mockRoute.hold = true;
    await render(
      <Host>
        <Counter />
      </Host>,
    );
    expect(screen.getByTestId("lock-pending-cover")).toBeTruthy();
    mockRoute.hold = false;
  });

  it("android: lock UI drawn outside the a11y-hidden content", async () => {
    const orig = Platform.OS;
    Platform.OS = "android";
    try {
      auth.mockResolvedValue({ success: false, error: "user_cancel" });
      await render(
        <Host>
          <Counter />
        </Host>,
      );
      await act(async () => {});
      expect(screen.getByTestId("lock-screen")).toBeTruthy();
      expect(screen.queryByTestId("lock-pending-cover")).toBeNull();
      // content hidden from a11y: default queries cannot see it
      expect(screen.queryByText("count 0 w 400")).toBeNull();
    } finally {
      Platform.OS = orig;
    }
  });

  it("pushes /lock above an open modal when locked, once; unlock removes only /lock", async () => {
    auth.mockResolvedValueOnce({ success: false, error: "user_cancel" });
    const r = await render(
      <Host>
        <Counter />
      </Host>,
    );
    await act(async () => {});
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith("/lock");
    await r.rerender(
      <Host>
        <Counter />
      </Host>,
    );
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.dispatch).not.toHaveBeenCalled();

    auth.mockResolvedValueOnce({ success: true });
    await fireEvent.press(screen.getByText("Unlock"));
    expect(mockRouter.dispatch).toHaveBeenCalledTimes(1);
    expect(mockRouter.dispatch).toHaveBeenCalledWith({ type: "POP", payload: { count: 1 }, source: "lock-1", target: "root" });
    expect(mockRouter.dismiss).not.toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });

  it("lock pushed while capture is on top, capture pushed above it: unlock removes only /lock", async () => {
    mockRoute.routes = ["(tabs)", "(modals)"];
    auth.mockResolvedValueOnce({ success: false, error: "user_cancel" });
    await render(
      <Host>
        <Counter />
      </Host>,
    );
    await act(async () => {});
    // A picker result lands after the lock: another modal ends up above /lock.
    mockRoute.routes = [...mockRoute.routes, "(modals)"];
    auth.mockResolvedValueOnce({ success: true });
    await fireEvent.press(screen.getByText("Unlock"));
    expect(mockRouter.dismiss).not.toHaveBeenCalled();
    expect(mockRouter.dispatch).toHaveBeenCalledTimes(1);
    expect(mockRoute.routes).toEqual(["(tabs)", "(modals)", "(modals)"]);
  });

  it("deep link to /lock while unlocked: the route removes itself (home when alone)", async () => {
    mockTimeout = 600;
    auth.mockResolvedValueOnce({ success: true });
    await render(
      <Host>
        <Counter />
      </Host>,
    );
    await act(async () => {});
    expect(screen.queryByTestId("lock-screen")).toBeNull();
    mockRouter.dispatch.mockReset();
    // /lock opened by a link while unlocked, alone in the stack.
    mockRoute.seq++;
    mockRoute.routes = ["lock"];
    await act(async () => mockRoute.setShown?.(true));
    expect(mockRouter.replace).toHaveBeenCalledWith("/");
    expect(screen.queryByTestId("lock-screen")).toBeNull();
  });

  it("shows the overlay on first render and prompts once; failure does not loop", async () => {
    auth.mockResolvedValue({ success: false, error: "user_cancel" });
    await render(
      <Host>
        <Counter />
      </Host>,
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
      <Host>
        <Counter />
      </Host>
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
      <Host>
        <Counter />
      </Host>,
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
      <Host>
        <Counter />
      </Host>,
    );
    await act(async () => {});
    await act(async () => listener.current?.("inactive"));
    await act(async () => listener.current?.("active"));
    await r.rerender(
      <Host>
        <Counter />
      </Host>,
    );
    expect(auth).toHaveBeenCalledTimes(1);
  });
});
