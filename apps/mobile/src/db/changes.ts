import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
let version = 0;

/** Call after any write that can change what a list/total shows. */
export function notifyDataChanged(): void {
  version++;
  for (const cb of [...listeners]) cb();
}

export function subscribeDataChanged(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Increments on every notify; use as a dependency to re-run queries. */
export function useDataVersion(): number {
  return useSyncExternalStore(subscribeDataChanged, () => version);
}
