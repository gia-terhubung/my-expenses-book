import { prefsEncryptionKey } from "./mmkvKey";

describe("prefsEncryptionKey", () => {
  it("is 32 ascii hex chars (<= 32 bytes for AES-256), deterministic, master-dependent", () => {
    const a = prefsEncryptionKey(new Uint8Array(32).fill(1));
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(Buffer.byteLength(a, "utf8")).toBe(32);
    expect(prefsEncryptionKey(new Uint8Array(32).fill(1))).toBe(a);
    expect(prefsEncryptionKey(new Uint8Array(32).fill(2))).not.toBe(a);
  });
});
