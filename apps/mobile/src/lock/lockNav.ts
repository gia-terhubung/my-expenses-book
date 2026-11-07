/** The slice of React Navigation state the lock needs (root state from the container ref). */
export type NavState = {
  key: string;
  index?: number;
  routes: { key: string; name: string; state?: Partial<NavState> }[];
};

export type LockRouteRef = { routeKey: string; parentKey: string; index: number };

/** Finds the `/lock` route anywhere in the tree (it lives in the root Stack), by name, not position. */
export function findLockRoute(state: Partial<NavState> | undefined): LockRouteRef | null {
  if (!state?.routes || !state.key) return null;
  for (const [index, r] of state.routes.entries()) {
    if (r.name === "lock") return { routeKey: r.key, parentKey: state.key, index };
    const nested = findLockRoute(r.state);
    if (nested) return nested;
  }
  return null;
}

/**
 * Action that removes exactly the route `ref` from its Stack, keeping any route pushed above it
 * (StackRouter POP with `source` + `target` removes that route, not the focused one).
 */
export function popRouteAction(ref: LockRouteRef) {
  return { type: "POP", payload: { count: 1 }, source: ref.routeKey, target: ref.parentKey } as const;
}

export interface LockNavigator {
  getRootState(): Partial<NavState> | undefined;
  dispatch(action: ReturnType<typeof popRouteAction>): void;
}

/**
 * Removes the `/lock` route by identity (never `router.dismiss()`, which pops whatever is on top,
 * e.g. a capture modal pushed after the lock). When /lock is the only route in its Stack (a cold
 * deep link to /lock) there is nothing to pop back to, so `goHome` replaces it with the home tab.
 * `skipKey` makes repeated calls for the same route no-ops. Returns the removed route key or null.
 */
export function removeLockRoute(nav: LockNavigator, goHome: () => void, skipKey?: string | null): string | null {
  const ref = findLockRoute(nav.getRootState());
  if (!ref || ref.routeKey === skipKey) return null;
  if (ref.index > 0) nav.dispatch(popRouteAction(ref));
  else goHome();
  return ref.routeKey;
}
