import { deviceTimeZone } from "@/capture/localTime";

import { devTimeZone, now, parseDevClock, setDevClock } from "./clock";

const REAL = Date.parse("2026-11-20T10:00:00Z");

describe("parseDevClock", () => {
  it("turns an ISO instant into an offset from the real clock", () => {
    expect(parseDevClock({ now: "2027-02-21T10:00:00Z" }, REAL)).toEqual({
      offsetMs: Date.parse("2027-02-21T10:00:00Z") - REAL,
      tz: null,
    });
    expect(parseDevClock({ now: "2026-11-20T17:00:00+07:00" }, REAL)).toEqual({ offsetMs: 0, tz: null });
  });

  it("accepts a zone alone or with a time", () => {
    expect(parseDevClock({ tz: "Asia/Jakarta" }, REAL)).toEqual({ offsetMs: 0, tz: "Asia/Jakarta" });
    expect(parseDevClock({ now: "2026-11-21T10:00:00.500Z", tz: "America/Sao_Paulo" }, REAL)).toEqual({
      offsetMs: 86_400_500,
      tz: "America/Sao_Paulo",
    });
  });

  it("clears on no params or reset=1", () => {
    expect(parseDevClock({}, REAL)).toBeNull();
    expect(parseDevClock({ reset: "1", now: "2027-01-01T00:00:00Z" }, REAL)).toBeNull();
  });

  it("rejects malformed params", () => {
    expect(parseDevClock({ now: "2027-02-21" }, REAL)).toBeUndefined();
    expect(parseDevClock({ now: "2027-02-21T10:00:00" }, REAL)).toBeUndefined(); // no zone
    expect(parseDevClock({ now: "2027-13-45T10:00:00Z" }, REAL)).toBeUndefined();
    expect(parseDevClock({ now: "soon" }, REAL)).toBeUndefined();
    expect(parseDevClock({ tz: "Mars/Olympus" }, REAL)).toBeUndefined();
    expect(parseDevClock({ now: "2027-02-21T10:00:00Z", tz: "Nope/Zone" }, REAL)).toBeUndefined();
  });
});

describe("dev clock override", () => {
  // Plain-node runs have no __DEV__ global; act as a dev build here.
  const g = globalThis as { __DEV__?: boolean };
  const was = g.__DEV__;
  beforeEach(() => {
    g.__DEV__ = true;
  });
  afterEach(() => {
    setDevClock(null);
    g.__DEV__ = was;
  });

  it("shifts now() and the device zone while set, and restores them when cleared", () => {
    const realZone = deviceTimeZone();
    setDevClock({ offsetMs: 90 * 86_400_000, tz: "Pacific/Auckland" });
    expect(now().getTime() - Date.now()).toBeGreaterThan(90 * 86_400_000 - 1000);
    expect(devTimeZone()).toBe("Pacific/Auckland");
    expect(deviceTimeZone()).toBe("Pacific/Auckland");

    setDevClock(null);
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(1000);
    expect(devTimeZone()).toBeNull();
    expect(deviceTimeZone()).toBe(realZone);
  });

  it("keeps the real zone when only the time is shifted", () => {
    const realZone = deviceTimeZone();
    setDevClock({ offsetMs: 1000, tz: null });
    expect(deviceTimeZone()).toBe(realZone);
  });

  it("never applies outside dev builds", () => {
    g.__DEV__ = false;
    setDevClock({ offsetMs: 90 * 86_400_000, tz: "Pacific/Auckland" });
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(1000);
    expect(devTimeZone()).toBeNull();
    // A clock set in a dev session is ignored once __DEV__ is false.
    g.__DEV__ = true;
    setDevClock({ offsetMs: 90 * 86_400_000, tz: "Pacific/Auckland" });
    g.__DEV__ = false;
    expect(Math.abs(now().getTime() - Date.now())).toBeLessThan(1000);
    expect(devTimeZone()).toBeNull();
  });
});
