import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { i18n } from "@/i18n";
import { usePref } from "@/prefs/PrefsProvider";

import { shouldLock } from "./lockPolicy";

/** Errors meaning the device has no usable credential: fail open so the user is never locked out. */
const NO_CREDENTIAL = new Set(["not_enrolled", "passcode_not_set"]);

/**
 * Lock state. Re-evaluates only on AppState background -> active; `inactive` (Face ID prompt,
 * Control Center) and window size changes never lock.
 */
export function useLockGate(): {
  locked: boolean;
  covered: boolean;
  unlock(): Promise<boolean>;
} {
  const lockEnabled = usePref("lockEnabled");
  const timeoutSec = usePref("lockTimeout");
  const [locked, setLocked] = useState(() =>
    shouldLock({
      lockEnabled,
      lastBackgroundAt: null,
      now: Date.now(),
      timeoutSec,
      coldStart: true,
    }),
  );
  const [covered, setCovered] = useState(false);
  const lastBackgroundAt = useRef<number | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        // An in-flight unlock (Android <=10 PIN fallback backgrounds the app) must not re-lock.
        if (busy.current || !lockEnabled) return;
        lastBackgroundAt.current ??= Date.now();
        // Hide content in the app switcher / on resume: lock now (timeout 0) or cover.
        if (timeoutSec === 0) setLocked(true);
        else setCovered(true);
      } else if (state === "active" && lastBackgroundAt.current !== null) {
        const at = lastBackgroundAt.current;
        lastBackgroundAt.current = null;
        setCovered(false);
        if (
          shouldLock({
            lockEnabled,
            timeoutSec,
            lastBackgroundAt: at,
            now: Date.now(),
            coldStart: false,
          })
        ) {
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
      let ok = res.success;
      if (!res.success) {
        ok = NO_CREDENTIAL.has(res.error);
        // not_available is ambiguous (e.g. transient): fail open only if no credential exists at all.
        if (res.error === "not_available") {
          ok =
            (await LocalAuthentication.getEnrolledLevelAsync()) ===
            LocalAuthentication.SecurityLevel.NONE;
        }
      }
      if (ok) {
        lastBackgroundAt.current = null;
        setCovered(false);
        setLocked(false);
      }
      return ok;
    } catch {
      return false;
    } finally {
      busy.current = false;
    }
  }, []);

  // Turning the lock off while locked must not leave an overlay behind.
  return {
    locked: locked && lockEnabled,
    covered: covered && lockEnabled,
    unlock,
  };
}
