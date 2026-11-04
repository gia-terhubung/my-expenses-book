import * as LocalAuthentication from "expo-local-authentication";

import { canEnableLock, shouldLock } from "./lockPolicy";

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
}));

const base = { lockEnabled: true, lastBackgroundAt: null, now: 1_000_000, timeoutSec: 60 as const, coldStart: false };

describe("shouldLock", () => {
  it("never locks when disabled", () => {
    expect(shouldLock({ ...base, lockEnabled: false, coldStart: true })).toBe(false);
  });
  it("locks on cold start when enabled", () => {
    expect(shouldLock({ ...base, coldStart: true })).toBe(true);
  });
  it("does not lock after 30s with 60s timeout", () => {
    expect(shouldLock({ ...base, lastBackgroundAt: base.now - 30_000 })).toBe(false);
  });
  it("locks after exactly 60s with 60s timeout", () => {
    expect(shouldLock({ ...base, lastBackgroundAt: base.now - 60_000 })).toBe(true);
  });
  it("timeout 0 locks after 1ms", () => {
    expect(shouldLock({ ...base, timeoutSec: 0, lastBackgroundAt: base.now - 1 })).toBe(true);
  });
  it("does not lock without a recorded background time", () => {
    expect(shouldLock(base)).toBe(false);
  });
});

describe("canEnableLock", () => {
  const hw = LocalAuthentication.hasHardwareAsync as jest.Mock;
  const enrolled = LocalAuthentication.isEnrolledAsync as jest.Mock;

  it("no hardware", async () => {
    hw.mockResolvedValue(false);
    enrolled.mockResolvedValue(true);
    expect(await canEnableLock()).toEqual({ ok: false, reason: "no_hardware" });
  });
  it("not enrolled", async () => {
    hw.mockResolvedValue(true);
    enrolled.mockResolvedValue(false);
    expect(await canEnableLock()).toEqual({ ok: false, reason: "not_enrolled" });
  });
  it("ok", async () => {
    hw.mockResolvedValue(true);
    enrolled.mockResolvedValue(true);
    expect(await canEnableLock()).toEqual({ ok: true });
  });
});
