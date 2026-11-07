import { scrypt } from "react-native-quick-crypto";

export type KdfParams = { name: "scrypt"; N: number; r: number; p: number; salt: string };

export const DEFAULT_KDF = { N: 32768, r: 8, p: 1 } as const;
export const MIN_PASSPHRASE = 8;
export const KEY_LEN = 32;
export const SCRYPT_MAXMEM = 64 * 1024 * 1024;

export function deriveArchiveKey(passphrase: string, params: KdfParams): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    scrypt(
      Buffer.from(passphrase.normalize("NFC"), "utf8"),
      Buffer.from(params.salt, "hex"),
      KEY_LEN,
      { N: params.N, r: params.r, p: params.p, maxmem: SCRYPT_MAXMEM },
      (err, key) => {
        if (err || !key) reject(err ?? new Error("scrypt failed"));
        else resolve(new Uint8Array(key));
      },
    );
  });
}
