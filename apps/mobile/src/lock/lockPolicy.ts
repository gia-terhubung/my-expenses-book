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
export function shouldLock({ lockEnabled, lastBackgroundAt, now, timeoutSec, coldStart }: LockInput): boolean {
  if (!lockEnabled) return false;
  if (coldStart) return true;
  if (lastBackgroundAt === null) return false;
  return now - lastBackgroundAt >= timeoutSec * 1000;
}

export type CanEnableLock = { ok: boolean; reason?: "no_hardware" | "not_enrolled" };

export async function canEnableLock(): Promise<CanEnableLock> {
  if (!(await LocalAuthentication.hasHardwareAsync())) return { ok: false, reason: "no_hardware" };
  if (!(await LocalAuthentication.isEnrolledAsync())) return { ok: false, reason: "not_enrolled" };
  return { ok: true };
}
