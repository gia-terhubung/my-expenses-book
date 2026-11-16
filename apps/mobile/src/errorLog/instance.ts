import type { KV } from "@/prefs/prefs";

import { createErrorLog, ERROR_LOG_KEY, MAX_ENTRIES, type ErrorEntry, type ErrorLog } from "./errorLog";

function memoryKV(): KV {
  const m = new Map<string, string>();
  return { getString: (k) => m.get(k), set: (k, v) => void m.set(k, v), delete: (k) => void m.delete(k) };
}

// Until the encrypted prefs store opens (after the master key loads), entries wait in memory.
let buffer = memoryKV();
let current: ErrorLog = createErrorLog(buffer);

/** Called once the encrypted prefs MMKV is open; buffered entries move into it. */
export function attachErrorLogStorage(kv: KV): void {
  try {
    const early = createErrorLog(buffer).list();
    const log = createErrorLog(kv);
    if (early.length) {
      const merged: ErrorEntry[] = [...early, ...log.list()].slice(0, MAX_ENTRIES);
      kv.set(ERROR_LOG_KEY, JSON.stringify(merged));
    }
    current = log;
    buffer = memoryKV();
  } catch {
    current = createErrorLog(kv);
  }
}

export const errorLog: ErrorLog = {
  append: (scope, e) => current.append(scope, e),
  list: () => current.list(),
  clear: () => current.clear(),
  toText: (v) => current.toText(v),
};

export function logError(scope: string, e: unknown): void {
  try {
    current.append(scope, e);
  } catch {
    // never throws
  }
}

export function resetErrorLogForTests(): void {
  buffer = memoryKV();
  current = createErrorLog(buffer);
}
