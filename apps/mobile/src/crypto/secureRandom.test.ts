import { assertSecureRandom } from "./secureRandom";

describe("assertSecureRandom", () => {
  it("passes when getRandomValues is a function", () => {
    expect(() => assertSecureRandom({ crypto: { getRandomValues: () => {} } })).not.toThrow();
  });
  it("throws when crypto is missing", () => {
    expect(() => assertSecureRandom({})).toThrow(/secure random/i);
  });
  it("throws when getRandomValues is not a function", () => {
    expect(() => assertSecureRandom({ crypto: { getRandomValues: 1 } })).toThrow(/secure random/i);
  });
});
