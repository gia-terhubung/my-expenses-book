import { hamming } from "./dhash";

describe("hamming", () => {
  it("counts all 64 differing bits", () => {
    expect(hamming("ffffffffffffffff", "0000000000000000")).toBe(64);
  });

  it("returns 0 for identical hashes", () => {
    expect(hamming("0123456789abcdef", "0123456789abcdef")).toBe(0);
  });

  it("counts single-bit differences and ignores case", () => {
    expect(hamming("0000000000000001", "0000000000000000")).toBe(1);
    expect(hamming("ABCDEF0000000000", "abcdef0000000000")).toBe(0);
  });

  it("throws on length mismatch", () => {
    expect(() => hamming("ffff", "ffffffffffffffff")).toThrow();
  });

  it("throws on non-hex input", () => {
    expect(() => hamming("zzzzzzzzzzzzzzzz", "0000000000000000")).toThrow();
  });
});
