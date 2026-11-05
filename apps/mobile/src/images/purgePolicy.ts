/** Ruling F: purge decrypted files only on "background" (iOS "inactive" fires for system dialogs and pickers). */
export function shouldPurgeOnAppState(state: string): boolean {
  return state === "background";
}

/** What the AppState purge removes; capture work files survive while a capture holds the lease (Ruling I). */
export function purgeScopeOnAppState(
  state: string,
  captureRunning: boolean,
): { keepCaptureWork: boolean } | null {
  return shouldPurgeOnAppState(state) ? { keepCaptureWork: captureRunning } : null;
}
