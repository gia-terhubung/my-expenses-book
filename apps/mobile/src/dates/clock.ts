/** The app's wall clock for date-driven features (recurring catch-up, Stats). One place to override in dev. */

/** Dev-only shift of the wall clock and device zone (end-to-end tests jump in time with it). */
export type DevClock = { offsetMs: number; tz: string | null };

let devClock: DevClock | null = null;

// Plain-node test runs have no __DEV__ global; Metro folds it to false in release builds.
const isDev = (): boolean => typeof __DEV__ !== "undefined" && __DEV__;

export function now(): Date {
  // __DEV__ is false in release builds, so the override can never apply there.
  if (devClock && isDev()) return new Date(Date.now() + devClock.offsetMs);
  return new Date();
}

/** The dev zone override, or null (always null in release builds). */
export function devTimeZone(): string | null {
  return devClock && isDev() ? devClock.tz : null;
}

/** Sets (or with null clears) the dev clock. Ignored in release builds. */
export function setDevClock(next: DevClock | null): void {
  if (!isDev()) return;
  devClock = next;
}

function validZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parses the `myexpensesbook://dev/clock` query: `now` (ISO 8601 instant with a zone, e.g.
 * 2027-02-21T10:00:00Z) and/or `tz` (IANA). No params, or `reset=1`, clears the override.
 * Returns undefined when a param is malformed (nothing is changed then).
 */
export function parseDevClock(
  params: { now?: string; tz?: string; reset?: string },
  realNowMs: number,
): DevClock | null | undefined {
  if (params.reset === "1" || (!params.now && !params.tz)) return null;
  let offsetMs = 0;
  if (params.now) {
    // A zone is required: a bare wall time would be read in the simulator's zone.
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(params.now)) return undefined;
    const target = Date.parse(params.now);
    if (Number.isNaN(target)) return undefined;
    offsetMs = target - realNowMs;
  }
  if (params.tz && !validZone(params.tz)) return undefined;
  return { offsetMs, tz: params.tz || null };
}
