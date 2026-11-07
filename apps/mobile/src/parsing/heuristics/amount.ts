export type FoundAmount = {
  /** Major-unit decimal string, e.g. "96000", "1234.56". */
  value: string;
  raw: string;
  negative: boolean;
  start: number;
};

const CUR =
  "(?:Rp\\.?|IDR|USD|EUR|GBP|JPY|SGD|MYR|THB|VND|AUD|BRL|CNY|(?:US|S|A|AU|C|CA|HK|NT|R)\\$|\\$|€|£|¥|RM|฿|₫|₩|₹)";
// open-paren? sign? currency? sign? number close-paren?. Sign must touch the currency/digit.
// A separator followed by a space continues the token only before a 3-digit group or a final 2-digit decimal.
const AMOUNT_RE = new RegExp(
  `(\\()?(?<![\\w.])([-−–])?(?:${CUR}\\s*)?([-−–])?(\\d+(?:[.,]\\d+|[.,] \\d{3}(?!\\d)|[.,] \\d{2}(?![.,]?\\d))*)(\\s*\\))?`,
  "giu",
);

/** Normalise a separator-laden numeric token to a plain decimal string. */
export function normalizeNumber(token: string): string {
  const t = token.replace(/\s+/g, "");
  const seps = [...t].filter((c) => c === "." || c === ",");
  if (seps.length === 0) return stripZeros(t);
  const lastIdx = Math.max(t.lastIndexOf("."), t.lastIndexOf(","));
  const lastSep = t[lastIdx]!;
  const tail = t.slice(lastIdx + 1);
  const kinds = new Set(seps);
  let decimalSep: string | null;
  if (kinds.size === 2) {
    decimalSep = lastSep;
  } else if (seps.length > 1) {
    decimalSep = null; // repeated same separator -> thousands
  } else if (tail.length === 3 && !/^0[.,]/.test(t)) {
    decimalSep = null; // single separator + exactly 3 digits -> thousands
  } else {
    decimalSep = lastSep;
  }
  if (decimalSep === null) return stripZeros(t.replace(/[.,]/g, ""));
  const intPart = t.slice(0, lastIdx).replace(/[.,]/g, "");
  return stripZeros(tail === "" ? intPart : `${intPart}.${tail}`);
}

function stripZeros(s: string): string {
  const [i = "", f] = s.split(".");
  const ii = i.replace(/^0+(?=\d)/, "");
  return f === undefined || /^0*$/.test(f) ? ii : `${ii}.${f}`;
}

export function findAmounts(line: string): FoundAmount[] {
  const out: FoundAmount[] = [];
  for (const m of line.matchAll(AMOUNT_RE)) {
    const open = m[1];
    const close = m[5];
    const negative = Boolean(m[2] || m[3] || (open && close));
    const value = normalizeNumber(m[4]!);
    out.push({ value, raw: m[0].trim(), negative, start: m.index ?? 0 });
  }
  return out;
}
