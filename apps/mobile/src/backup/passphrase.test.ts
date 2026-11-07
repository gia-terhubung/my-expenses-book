import { validatePassphrase } from "./passphrase";

describe("validatePassphrase", () => {
  it("too short", () => expect(validatePassphrase("1234567", "1234567")).toBe("tooShort"));
  it("mismatch", () => expect(validatePassphrase("12345678", "12345679")).toBe("mismatch"));
  it("ok", () => expect(validatePassphrase("12345678", "12345678")).toBe("ok"));
  it("NFC and NFD forms of the same word are ok", () => {
    const nfc = "cafécafé"; // 8 code points
    const nfd = nfc.normalize("NFD");
    expect(validatePassphrase(nfd, nfc)).toBe("ok");
  });
});
