import { createMMKV, deleteMMKV } from "react-native-mmkv";

import { createPrefs, type KV, type PrefsStore } from "./prefs";

export const PREFS_MMKV_ID = "meb.prefs";

export function openPrefs(encryptionKey: string): PrefsStore {
  const mmkv = createMMKV({ id: PREFS_MMKV_ID, encryptionKey, encryptionType: "AES-256" });
  const kv: KV = {
    getString: (k) => mmkv.getString(k),
    set: (k, v) => mmkv.set(k, v),
    delete: (k) => void mmkv.remove(k),
  };
  return createPrefs(kv);
}

/** Deletes the prefs file by id (works without the key); part of "erase all local data". */
export function deletePrefsStorage(): void {
  deleteMMKV(PREFS_MMKV_ID);
}
