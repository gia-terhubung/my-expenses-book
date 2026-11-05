import { randomBytes } from "node:crypto";

import { ImageDecryptError, decryptBytes, encryptBytes } from "./crypto";

const key = () => new Uint8Array(randomBytes(32));
const plain = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252]);

describe("image crypto", () => {
  it("round-trips", () => {
    const k = key();
    expect(Array.from(decryptBytes(k, encryptBytes(k, plain)))).toEqual(Array.from(plain));
  });

  it("round-trips empty input", () => {
    const k = key();
    expect(decryptBytes(k, encryptBytes(k, new Uint8Array(0))).length).toBe(0);
  });

  it("starts with MEB1 and has iv + tag overhead", () => {
    const blob = encryptBytes(key(), plain);
    expect(String.fromCharCode(...blob.slice(0, 4))).toBe("MEB1");
    expect(blob.length).toBe(4 + 12 + plain.length + 16);
  });

  it("two encryptions of the same input differ (random IV)", () => {
    const k = key();
    expect(Array.from(encryptBytes(k, plain))).not.toEqual(Array.from(encryptBytes(k, plain)));
  });

  it("tampered ciphertext byte throws ImageDecryptError", () => {
    const k = key();
    const blob = encryptBytes(k, plain);
    blob[17] ^= 0xff;
    expect(() => decryptBytes(k, blob)).toThrow(ImageDecryptError);
  });

  it("tampered tag throws ImageDecryptError", () => {
    const k = key();
    const blob = encryptBytes(k, plain);
    blob[blob.length - 1] ^= 0x01;
    expect(() => decryptBytes(k, blob)).toThrow(ImageDecryptError);
  });

  it("wrong key throws ImageDecryptError", () => {
    const blob = encryptBytes(key(), plain);
    expect(() => decryptBytes(key(), blob)).toThrow(ImageDecryptError);
  });

  it("bad magic and truncated blobs throw ImageDecryptError", () => {
    const k = key();
    const blob = encryptBytes(k, plain);
    const bad = blob.slice();
    bad[0] = 0x58;
    expect(() => decryptBytes(k, bad)).toThrow(ImageDecryptError);
    expect(() => decryptBytes(k, blob.slice(0, 20))).toThrow(ImageDecryptError);
  });
});
