import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { i18n } from "@/i18n";
import { usePref } from "@/prefs/PrefsProvider";

import { shouldLock } from "./lockPolicy";

/** Errors meaning the device has no usable credential: fail open so the user is never locked out. */
const NO_CREDENTIAL = new Set(["not_enrolled", "passcode_not_set", "not_available"]);

/**
 * Lock state. Re-evaluates only on AppState background -> active; `inactive` (Face ID prompt,
 * Control Center) and window size changes never lock.
 */
export function useLockGate(): { locked: boolean; unlock(): Promise<boolean> } {
  const lockEnabled = usePref("lockEnabled");
  const timeoutSec = usePref("lockTimeout");
  const [locked, setLocked] = useState(() =>
    shouldLock({ lockEnabled, lastBackgroundAt: null, now: Date.now(), timeoutSec, coldStart: true }),
  );
  const lastBackgroundAt = useRef<number | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        lastBackgroundAt.current ??= Date.now();
      } else if (state === "active" && lastBackgroundAt.current !== null) {
        const at = lastBackgroundAt.current;
        lastBackgroundAt.current = null;
        if (shouldLock({ lockEnabled, timeoutSec, lastBackgroundAt: at, now: Date.now(), coldStart: false })) {
          setLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, [lockEnabled, timeoutSec]);

  const unlock = useCallback(async () => {
    if (busy.current) return false;
    busy.current = true;
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: i18n.t("lock.reason"),
        cancelLabel: i18n.t("common.cancel"),
        disableDeviceFallback: false,
      });
      const ok = res.success || (!res.success && NO_CREDENTIAL.has(res.error));
      if (ok) setLocked(false);
      return ok;
    } catch {
      return false;
    } finally {
      busy.current = false;
    }
  }, []);

  // Turning the lock off while locked must not leave an overlay behind.
  return { locked: locked && lockEnabled, unlock };
}
