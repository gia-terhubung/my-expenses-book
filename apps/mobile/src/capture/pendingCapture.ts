import type { CaptureMode } from "./CaptureSheet";

type Pending = { mode: CaptureMode; uris: string[] };

/**
 * In-memory hand-off of picker/scanner results to the capture route. Route params carry only
 * a random one-time token, so a deep link can never name files for the app to ingest/delete.
 */
export interface PendingCaptures {
  put(mode: CaptureMode, uris: string[]): string;
  /** The entry for `token`, once; null for unknown, used or missing tokens. */
  take(token: string | undefined): Pending | null;
}

function randomToken(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createPendingCaptures(): PendingCaptures {
  const entries = new Map<string, Pending>();
  return {
    put(mode, uris) {
      const token = randomToken();
      entries.set(token, { mode, uris: [...uris] });
      return token;
    },
    take(token) {
      if (!token) return null;
      const e = entries.get(token);
      if (!e) return null;
      entries.delete(token);
      return e;
    },
  };
}

/** App-wide holder shared by the Receipts tab (put) and the capture route (take). */
export const pendingCaptures = createPendingCaptures();

function parseUris(raw: string | undefined): string[] | null {
  try {
    const v: unknown = JSON.parse(raw ?? "");
    return Array.isArray(v) && v.every((u) => typeof u === "string") ? (v as string[]) : null;
  } catch {
    return null;
  }
}

/**
 * Capture groups for the route: from a pending token (one group per photo, or one group of
 * scanner pages). `uris` in params is honoured only in dev builds (simulator checks); release
 * builds ignore it. Null = nothing to capture (close the screen).
 */
export function resolveCaptureRequest(
  params: { token?: string; mode?: string; uris?: string },
  opts: { dev: boolean; pending: PendingCaptures },
): string[][] | null {
  let req: Pending | null = opts.pending.take(params.token);
  if (!req && opts.dev && params.uris !== undefined) {
    const uris = parseUris(params.uris);
    req = uris ? { mode: params.mode === "scan" ? "scan" : "photos", uris } : null;
  }
  if (!req || req.uris.length === 0) return null;
  return req.mode === "scan" ? [req.uris] : req.uris.map((u) => [u]);
}
