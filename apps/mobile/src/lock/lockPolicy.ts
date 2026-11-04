import * as LocalAuthentication from "expo-local-authentication";

import type { LockTimeout } from "@/prefs/prefs";

export interface LockInput {
  lockEnabled: boolean;
  lastBackgroundAt: number | null;
  now: number;
  timeoutSec: LockTimeout;
  coldStart: boolean;
}

/** Lock on cold start, or when backgrounded for at least the timeout (0 = any background trip). */
export function shouldLock({
  lockEnabled,
  lastBackgroundAt,
  now,
  timeoutSec,
  coldStart,
}: LockInput): boolean {
  if (!lockEnabled) return false;
  if (coldStart) return true;
  if (lastBackgroundAt === null) return false;
  return now - lastBackgroundAt >= timeoutSec * 1000;
}

export type CanEnableLock = {
  ok: boolean;
  reason?: "no_hardware" | "not_enrolled";
};

/** Device passcode counts: only an enrolled level of NONE blocks enabling. */
export async function canEnableLock(): Promise<CanEnableLock> {
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  if (level >= LocalAuthentication.SecurityLevel.SECRET) return { ok: true };
  return (await LocalAuthentication.hasHardwareAsync())
    ? { ok: false, reason: "not_enrolled" }
    : { ok: false, reason: "no_hardware" };
}
