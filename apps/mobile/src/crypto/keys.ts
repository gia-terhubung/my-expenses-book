import { hkdfSync, randomBytes } from "react-native-quick-crypto";

export type KeyPurpose = "db" | "images" | "prefs";

export interface SecretStore {
  get(k: string): Promise<string | null>;
  set(k: string, v: string): Promise<void>;
}

const MASTER_KEY_NAME = "mrb.masterKey.v1";

// prefs key is 16 bytes: MMKV encryption key limit.
const KEY_LENGTH: Record<KeyPurpose, number> = { db: 32, images: 32, prefs: 16 };

export function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function getOrCreateMasterKey(store: SecretStore): Promise<Uint8Array> {
  const existing = await store.get(MASTER_KEY_NAME);
  if (existing && /^[0-9a-f]{64}$/.test(existing)) return fromHex(existing);
  const key = new Uint8Array(randomBytes(32));
  await store.set(MASTER_KEY_NAME, toHex(key));
  return key;
}

export function deriveKey(master: Uint8Array, purpose: KeyPurpose): Uint8Array {
  // Node returns ArrayBuffer, quick-crypto a Buffer; Uint8Array copy handles both.
  return new Uint8Array(
    hkdfSync("sha256", master, new Uint8Array(0), `mrb-${purpose}-v1`, KEY_LENGTH[purpose]),
  );
}
