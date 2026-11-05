import type * as ScreenCapture from "expo-screen-capture";

export type ScreenCaptureApi = Pick<
  typeof ScreenCapture,
  | "enableAppSwitcherProtectionAsync"
  | "disableAppSwitcherProtectionAsync"
  | "preventScreenCaptureAsync"
  | "allowScreenCaptureAsync"
>;

/** Blur the app-switcher snapshot (iOS) and block screenshots/recording + recents preview (Android) while the lock is on. */
export async function applySnapshotProtection(
  enabled: boolean,
  // Lazy so node-env tests that inject a fake never load the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sc: ScreenCaptureApi = require("expo-screen-capture"),
): Promise<void> {
  if (enabled) {
    await Promise.all([
      sc.enableAppSwitcherProtectionAsync(),
      sc.preventScreenCaptureAsync(),
    ]);
  } else {
    await Promise.all([
      sc.disableAppSwitcherProtectionAsync(),
      sc.allowScreenCaptureAsync(),
    ]);
  }
}
