/**
 * Hamming distance between two dHash hex strings from `imageHash` (modules/receipt-ocr).
 *
 * Native hash layout (identical on iOS and Android): the upright image is reduced to a
 * 9×8 grid of mean luma (0.299R + 0.587G + 0.114B); for row r (0..7, top→bottom) and
 * column c (0..7, left→right) the bit is 1 when cell(r,c) < cell(r,c+1). Bit index
 * r*8+c is packed MSB-first, so hex char 0 holds row 0, columns 0..3. Equal strings
 * from either platform therefore mean equal bits at equal grid positions.
 */
export function hamming(a: string, b: string): number {
  if (a.length !== b.length) throw new Error(`hamming: length mismatch (${a.length} vs ${b.length})`);
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i], 16);
    const y = parseInt(b[i], 16);
    if (Number.isNaN(x) || Number.isNaN(y)) throw new Error("hamming: non-hex input");
    let v = x ^ y;
    while (v) {
      d += v & 1;
      v >>= 1;
    }
  }
  return d;
}
