import { router } from "expo-router";
import { useEffect, useRef } from "react";

// One slot: a receipt opened while folded (pushed /document/[id]) that the person unfolded on.
let pending: string | null = null;

export function setPendingSelection(id: string): void {
  pending = id;
}

/** Returns the pending receipt id and clears the slot. */
export function takePendingSelection(): string | null {
  const id = pending;
  pending = null;
  return id;
}

/**
 * For the pushed receipt screen: once the layout is split (unfold, or opened on a wide screen) the
 * receipt belongs in the list's two-pane selection, so hand its id over and pop back to the list.
 * At most once per mount (a second back would leave the tabs), and never without a screen beneath
 * (a deep link keeps showing the receipt).
 */
export function usePopToSelection(id: string, split: boolean): void {
  const popped = useRef(false);
  useEffect(() => {
    if (!split || popped.current) return;
    popped.current = true;
    if (!router.canGoBack()) return;
    setPendingSelection(id);
    router.back();
  }, [id, split]);
}
