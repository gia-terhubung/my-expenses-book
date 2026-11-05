import { router, useRootNavigationState, type Href } from "expo-router";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { BackHandler, StyleSheet, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

import { LockScreen } from "./LockScreen";
import { applySnapshotProtection } from "./snapshotProtection";
import { useLockGate } from "./useLockGate";
import { usePref } from "@/prefs/PrefsProvider";

const UnlockContext = createContext<(() => Promise<boolean>) | null>(null);

/** Body of the `/lock` route (a native fullScreenModal, so it stacks above any open modal). */
export function LockRoute() {
  const unlock = useContext(UnlockContext);
  // Android back must not dismiss the lock.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);
  return unlock ? <LockScreen onUnlock={unlock} /> : null;
}

/**
 * While locked, pushes the `/lock` route once (above any modal) and dismisses it on unlock;
 * an opaque cover hides children until then (cold start: no flash). Children stay mounted. (No a11y-hiding wrapper: the /lock route lives inside children, and the native modal already hides content beneath it.)
 * Prompts once per lock; failure leaves the Retry button.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const { locked, covered, foreground, unlock } = useLockGate();
  const { colors } = useTheme();
  const prompted = useRef(false);
  const lockEnabled = usePref("lockEnabled");
  const navReady = !!useRootNavigationState()?.key;
  const lockPushed = useRef(false);

  useEffect(() => {
    void applySnapshotProtection(lockEnabled).catch(() => {});
  }, [lockEnabled]);

  useEffect(() => {
    if (!navReady) return;
    if (locked && !lockPushed.current) {
      lockPushed.current = true;
      // Typed-routes file is regenerated on `expo start`; cast keeps tsc green before that.
      router.push("/lock" as Href);
    } else if (!locked && lockPushed.current) {
      lockPushed.current = false;
      router.dismiss();
    }
  }, [locked, navReady]);

  useEffect(() => {
    // Re-arm whenever unlocked or backgrounded, so a cancelled background attempt can't use up
    // the single auto-prompt. While active, a failure is never retried automatically.
    if (!locked || !foreground) {
      prompted.current = false;
    } else if (!prompted.current) {
      prompted.current = true;
      void unlock();
    }
  }, [locked, foreground, unlock]);

  return (
    <UnlockContext.Provider value={unlock}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>{children}</View>
        {covered || locked ? (
          <View
            testID="privacy-cover"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.background },
            ]}
          />
        ) : null}
      </View>
    </UnlockContext.Provider>
  );
}
