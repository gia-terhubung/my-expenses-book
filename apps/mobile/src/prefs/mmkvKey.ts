import { deriveKey, toHex } from "@/crypto/keys";

/**
 * MMKV encryptionKey is a string of at most 16 bytes (AES-128) or 32 bytes (AES-256).
 * The 16-byte prefs subkey is hex-encoded to 32 ASCII chars (all 128 bits kept; raw bytes
 * would not survive string/UTF-8 conversion) and used with AES-256, which accepts 32 bytes.
 */
export function prefsEncryptionKey(master: Uint8Array): string {
  return toHex(deriveKey(master, "prefs"));
}
