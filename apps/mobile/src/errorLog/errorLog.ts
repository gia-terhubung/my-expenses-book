import type { KV } from "@/prefs/prefs";

export type ErrorEntry = { at: number; scope: string; message: string; stack?: string };

export const ERROR_LOG_KEY = "errorLog.v1";
export const MAX_ENTRIES = 200;
export const MAX_MESSAGE = 500;
export const MAX_STACK_LINES = 8;

export type ErrorLog = {
  append(scope: string, e: unknown): void;
  list(): ErrorEntry[];
  clear(): void;
  toText(appVersion: string): string;
};

function toEntry(scope: string, e: unknown, at: number): ErrorEntry {
  const message = (e instanceof Error ? e.message : String(e)).slice(0, MAX_MESSAGE);
  const stack = e instanceof Error && e.stack ? e.stack.split("\n").slice(0, MAX_STACK_LINES).join("\n") : undefined;
  return stack ? { at, scope, message, stack } : { at, scope, message };
}

function read(kv: KV): ErrorEntry[] {
  try {
    const raw = kv.getString(ERROR_LOG_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ErrorEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Local-only error log (spec: "Local error log viewable/exportable from Settings"). Newest
 * first, capped; never throws, so logging can never be the thing that breaks the app.
 */
export function createErrorLog(kv: KV, now: () => number = Date.now): ErrorLog {
  return {
    append(scope, e) {
      try {
        const next = [toEntry(scope, e, now()), ...read(kv)].slice(0, MAX_ENTRIES);
        kv.set(ERROR_LOG_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable: drop the entry.
      }
    },
    list: () => read(kv),
    clear() {
      try {
        kv.delete(ERROR_LOG_KEY);
      } catch {
        // ignore
      }
    },
    toText(appVersion) {
      const blocks = read(kv).map((x) =>
        [`${new Date(x.at).toISOString()} [${x.scope}] ${x.message}`, x.stack].filter(Boolean).join("\n"),
      );
      return [`My Expenses Book ${appVersion}`, ...blocks].join("\n\n") + "\n";
    },
  };
}
