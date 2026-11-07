import { StackRouter } from "expo-router/build/react-navigation/routers/StackRouter";

import { findLockRoute, popRouteAction, removeLockRoute, type NavState } from "./lockNav";

const route = (name: string) => ({ key: `${name}-k`, name, params: undefined });
const routeNames = ["(tabs)", "(modals)", "lock", "document/[id]"];

function rootState(names: string[]) {
  return {
    stale: false as const,
    type: "stack" as const,
    key: "root-stack",
    index: names.length - 1,
    routeNames,
    routes: names.map(route),
    preloadedRoutes: [],
  };
}

function reduce(state: ReturnType<typeof rootState>, action: ReturnType<typeof popRouteAction>) {
  const router = StackRouter({});
  const res = router.getStateForAction(state as never, action as never, { routeNames, routeGetIdList: {} }) as unknown as {
    state: { routes: { name: string }[]; index: number };
  } | null;
  return res?.state ?? null;
}

describe("lockNav", () => {
  it("finds /lock by name, also inside a wrapper navigator", () => {
    expect(findLockRoute(rootState(["(tabs)", "lock", "(modals)"]))).toEqual({
      routeKey: "lock-k",
      parentKey: "root-stack",
      index: 1,
    });
    const wrapped: Partial<NavState> = { key: "outer", routes: [{ key: "r", name: "__root", state: rootState(["(tabs)", "lock"]) }] };
    expect(findLockRoute(wrapped)?.parentKey).toBe("root-stack");
    expect(findLockRoute(rootState(["(tabs)", "(modals)"]))).toBeNull();
    expect(findLockRoute(undefined)).toBeNull();
  });

  it("lock pushed, then capture pushed above it: unlock removes only /lock", () => {
    const state = rootState(["(tabs)", "lock", "(modals)"]);
    const dispatched: ReturnType<typeof popRouteAction>[] = [];
    const removed = removeLockRoute({ getRootState: () => state, dispatch: (a) => dispatched.push(a) }, () => {
      throw new Error("must not go home");
    });
    expect(removed).toBe("lock-k");
    expect(dispatched).toHaveLength(1);
    const next = reduce(state, dispatched[0]);
    expect(next?.routes.map((r) => r.name)).toEqual(["(tabs)", "(modals)"]);
    expect(next?.index).toBe(1);
  });

  it("lock on top of capture: unlock removes /lock and keeps capture", () => {
    const state = rootState(["(tabs)", "(modals)", "lock"]);
    const dispatched: ReturnType<typeof popRouteAction>[] = [];
    removeLockRoute({ getRootState: () => state, dispatch: (a) => dispatched.push(a) }, () => undefined);
    expect(reduce(state, dispatched[0])?.routes.map((r) => r.name)).toEqual(["(tabs)", "(modals)"]);
  });

  it("is a no-op for the same route twice, or when /lock is gone", () => {
    const state = rootState(["(tabs)", "lock"]);
    const dispatch = jest.fn();
    expect(removeLockRoute({ getRootState: () => state, dispatch }, jest.fn(), "lock-k")).toBeNull();
    expect(removeLockRoute({ getRootState: () => rootState(["(tabs)"]), dispatch }, jest.fn())).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("/lock alone in the stack (cold deep link): goes home instead of popping", () => {
    const dispatch = jest.fn();
    const goHome = jest.fn();
    expect(removeLockRoute({ getRootState: () => rootState(["lock"]), dispatch }, goHome)).toBe("lock-k");
    expect(goHome).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
