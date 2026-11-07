import { type KdfParams, deriveArchiveKey } from "./kdf";

const params = (salt: string): KdfParams => ({ name: "scrypt", N: 1024, r: 8, p: 1, salt });
const S1 = "00112233445566778899aabbccddeeff";
const S2 = "ffeeddccbbaa99887766554433221100";

describe("deriveArchiveKey", () => {
  it("is deterministic: same passphrase + salt gives same 32-byte key", async () => {
    const a = await deriveArchiveKey("correct horse", params(S1));
    const b = await deriveArchiveKey("correct horse", params(S1));
    expect(a.length).toBe(32);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("different salt gives different key", async () => {
    const a = await deriveArchiveKey("correct horse", params(S1));
    const b = await deriveArchiveKey("correct horse", params(S2));
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it("NFC-normalizes the passphrase", async () => {
    const a = await deriveArchiveKey("p\u00e4ssw\u00f6rd", params(S1));
    const b = await deriveArchiveKey("p\u00e4ssw\u00f6rd".normalize("NFD"), params(S1));
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
