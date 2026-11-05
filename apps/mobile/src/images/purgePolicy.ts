/** Ruling F: purge decrypted files only on "background" (iOS "inactive" fires for system dialogs and pickers). */
export function shouldPurgeOnAppState(state: string): boolean {
  return state === "background";
}
