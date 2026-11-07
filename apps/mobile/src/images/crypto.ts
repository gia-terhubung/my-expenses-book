// Buffer is the global installed by react-native-quick-crypto install() (root _layout.tsx).
import { createCipheriv, createDecipheriv, randomBytes } from "react-native-quick-crypto";

// Format: "MEB1" | 12-byte random IV | ciphertext | 16-byte GCM tag.
const MAGIC = new Uint8Array([0x4d, 0x45, 0x42, 0x31]);
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER_LEN = MAGIC.length + IV_LEN;

export class ImageDecryptError extends Error {
  constructor(reason: string) {
    super(`Image cannot be decrypted: ${reason}`);
    this.name = "ImageDecryptError";
  }
}

export function encryptBytes(key: Uint8Array, plain: Uint8Array): Uint8Array {
  const iv = new Uint8Array(randomBytes(IV_LEN));
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  const out = new Uint8Array(HEADER_LEN + body.length + TAG_LEN);
  out.set(MAGIC, 0);
  out.set(iv, MAGIC.length);
  out.set(body, HEADER_LEN);
  out.set(tag, HEADER_LEN + body.length);
  return out;
}

export function decryptBytes(key: Uint8Array, blob: Uint8Array): Uint8Array {
  if (blob.length < HEADER_LEN + TAG_LEN) throw new ImageDecryptError("truncated");
  for (let i = 0; i < MAGIC.length; i++) {
    if (blob[i] !== MAGIC[i]) throw new ImageDecryptError("bad magic");
  }
  const iv = blob.slice(MAGIC.length, HEADER_LEN);
  const body = blob.slice(HEADER_LEN, blob.length - TAG_LEN);
  const tag = blob.slice(blob.length - TAG_LEN);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    // quick-crypto types its own Buffer class; the runtime value is the installed global.
    decipher.setAuthTag(Buffer.from(tag) as unknown as Parameters<typeof decipher.setAuthTag>[0]);
    return new Uint8Array(Buffer.concat([decipher.update(body), decipher.final()]));
  } catch {
    throw new ImageDecryptError("authentication failed");
  }
}
