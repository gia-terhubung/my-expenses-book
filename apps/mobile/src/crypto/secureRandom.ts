/** Throws unless a secure getRandomValues exists, so ids never fall back to Math.random. */
export function assertSecureRandom(g: { crypto?: { getRandomValues?: unknown } } = globalThis): void {
  if (typeof g.crypto?.getRandomValues !== "function") {
    throw new Error("Secure random source (crypto.getRandomValues) is unavailable.");
  }
}
