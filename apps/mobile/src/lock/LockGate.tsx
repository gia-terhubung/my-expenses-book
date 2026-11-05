import { router, useRootNavigationState, type Href } from "expo-router";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BackHandler, Platform, StyleSheet, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

import { AppObscuredContext } from "./appObscured";
import { LockScreen } from "./LockScreen";
import { applySnapshotProtection } from "./snapshotProtection";
import { useLockGate } from "./useLockGate";
import { usePref } from "@/prefs/PrefsProvider";

type LockCtx = { unlock(): Promise<boolean>; setMounted(v: boolean): void };
const UnlockContext = createContext<LockCtx | null>(null);

/**
 * Body of the `/lock` route (a native fullScreenModal, so on iOS it stacks above any open modal).
 * On Android the modal is a fragment inside the Stack, so the gate draws the lock UI itself,
 * outside the accessibility-hidden content, and the route stays blank.
 */
export function LockRoute() {
  const ctx = useContext(UnlockContext);
  const setMounted = ctx?.setMounted;
  useEffect(() => {
    setMounted?.(true);
    return () => setMounted?.(false);
  }, [setMounted]);
  // Android back must not dismiss the lock.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);
  return ctx && Platform.OS !== "android" ? (
    <LockScreen onUnlock={ctx.unlock} />
  ) : null;
}

/**
 * While locked, pushes the `/lock` route once (above any modal) and dismisses it on unlock;
 * a separate cold-start cover hides content only until /lock has mounted (no flash). The
 * backgrounded privacy cover is independent of lock state. Children stay mounted; on Android they
 * are hidden from accessibility while locked (iOS native modal already does that).
 * Prompts once per lock; failure leaves the Retry button.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const { locked, covered, foreground, unlock } = useLockGate();
  const { colors } = useTheme();
  const prompted = useRef(false);
  const lockEnabled = usePref("lockEnabled");
  const navReady = !!useRootNavigationState()?.key;
  const lockPushed = useRef(false);
  const [lockMounted, setLockMounted] = useState(false);
  const android = Platform.OS === "android";
  const ctx = useMemo<LockCtx>(
    () => ({ unlock, setMounted: setLockMounted }),
    [unlock],
  );

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

  const fill = [
    StyleSheet.absoluteFill,
    { backgroundColor: colors.background },
  ];
  return (
    <UnlockContext.Provider value={ctx}>
      <AppObscuredContext.Provider value={locked || covered}>
        <View style={{ flex: 1 }}>
          <View
            style={{ flex: 1 }}
            accessibilityElementsHidden={android && locked}
            importantForAccessibility={
              android && locked ? "no-hide-descendants" : "auto"
            }
          >
            {children}
          </View>
          {covered && !locked ? (
            <View testID="privacy-cover" style={fill} />
          ) : null}
          {locked && !lockMounted && !android ? (
            <View testID="lock-pending-cover" style={fill} />
          ) : null}
          {locked && android ? <LockScreen onUnlock={unlock} /> : null}
        </View>
      </AppObscuredContext.Provider>
    </UnlockContext.Provider>
  );
}
