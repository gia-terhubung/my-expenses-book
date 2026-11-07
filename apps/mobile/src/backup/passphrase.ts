import { MIN_PASSPHRASE, passphraseLength } from "./kdf";

/** Length is counted on the NFC form (code points); mismatch compares NFC forms too. */
export function validatePassphrase(p: string, confirm: string): "ok" | "tooShort" | "mismatch" {
  if (passphraseLength(p) < MIN_PASSPHRASE) return "tooShort";
  if (p.normalize("NFC") !== confirm.normalize("NFC")) return "mismatch";
  return "ok";
}
