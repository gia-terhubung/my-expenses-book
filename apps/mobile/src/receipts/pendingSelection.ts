import { useIsFocused, useNavigation } from "expo-router";
import { useEffect, useRef } from "react";

import { useAppObscured } from "@/lock/appObscured";

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
 * Acts only while this screen is focused and the app is not obscured: a `/lock` route or the edit
 * modal on top must never be popped (lock bypass, lost edits). Pops with this screen's own
 * navigation, one frame after the layout settled (a transient width/inset mismatch must not
 * trigger it), at most once, and never without a screen beneath (a deep link keeps showing it).
 */
export function usePopToSelection(id: string, split: boolean): void {
  const navigation = useNavigation();
  const focused = useIsFocused();
  const obscured = useAppObscured();
  const popped = useRef(false);
  useEffect(() => {
    if (!split || !focused || obscured || popped.current) return;
    const frame = requestAnimationFrame(() => {
      if (popped.current || !navigation.canGoBack()) return;
      popped.current = true;
      setPendingSelection(id);
      navigation.goBack();
    });
    return () => cancelAnimationFrame(frame);
  }, [id, split, focused, obscured, navigation]);
}
