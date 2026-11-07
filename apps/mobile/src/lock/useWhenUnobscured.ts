import { useCallback, useEffect, useState } from "react";

import { useAppObscured } from "./appObscured";

/**
 * Returns `defer(fn)`: runs `fn` once the app is not obscured (lock screen, privacy cover, or a
 * `/lock` route still mounted). Navigation from async work (picker result, finished capture) goes
 * through this so it never lands above, or replaces, the `/lock` route. A later `defer` replaces
 * a pending one.
 */
export function useWhenUnobscured(): (fn: () => void) => void {
  const obscured = useAppObscured();
  const [pending, setPending] = useState<(() => void) | null>(null);
  useEffect(() => {
    if (obscured || !pending) return;
    setPending(null);
    pending();
  }, [obscured, pending]);
  return useCallback((fn: () => void) => setPending(() => fn), []);
}
