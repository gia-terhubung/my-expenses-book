export type DateOrder = "DMY" | "MDY" | "YMD";
export type FoundDate = {
  date: string;
  time: string | null;
  confidence: number;
  start: number;
};

export function dateOrderFor(currency: string): DateOrder {
  if (currency === "USD") return "MDY";
  if (["JPY", "CNY", "KRW", "TWD"].includes(currency)) return "YMD";
  return "DMY";
}

const MONTHS: Record<number, string[]> = {
  1: ["january", "januari", "janeiro", "janvier", "januar", "enero", "janv", "jan", "ene"],
  2: ["february", "februari", "fevereiro", "fevrier", "février", "februar", "febrero", "feb", "fev", "fév"],
  3: ["march", "maret", "marco", "março", "mars", "marzo", "märz", "maerz", "mar", "mär", "mrz"],
  4: ["april", "abril", "avril", "apr", "abr", "avr"],
  5: ["may", "mei", "mai", "mayo", "maio"],
  6: ["june", "juni", "junho", "juin", "junio", "jun"],
  7: ["july", "juli", "julho", "juillet", "julio", "juil", "jul"],
  8: ["august", "agustus", "agosto", "aout", "août", "aug", "agu", "agt", "ago"],
  9: ["september", "septembre", "septiembre", "setiembre", "setembro", "sept", "sep", "set"],
  10: ["october", "oktober", "outubro", "octobre", "octubre", "oct", "okt", "out"],
  11: ["november", "novembro", "novembre", "noviembre", "nov"],
  12: ["december", "desember", "dezembro", "dezember", "diciembre", "decembre", "décembre", "dec", "des", "dez", "dic", "déc"],
};
const MONTH_LOOKUP = new Map<string, number>();
for (const [n, words] of Object.entries(MONTHS)) for (const w of words) MONTH_LOOKUP.set(w, Number(n));
const MON = [...MONTH_LOOKUP.keys()].sort((a, b) => b.length - a.length).join("|");

const TEXT_DMY = new RegExp(
  `(?<![\\d\\p{L}])(\\d{1,2})(?:st|nd|rd|th)?[\\s.\\-/]*(?:de\\s+)?(${MON})\\.?[\\s,.\\-/]*(?:de\\s+)?(\\d{4}|\\d{2})(?![\\d:])`,
  "giu",
);
const TEXT_MDY = new RegExp(
  `(?<![\\d\\p{L}])(${MON})\\.?\\s*(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})(?!\\d)`,
  "giu",
);
const ISO = /(?<![\d.,/-])(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?![\d])/g;
const NUMERIC = /(?<![\d.,/-])(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?![\d])/g;

const TIME_AFTER =
  /^[\s,•|@\-/]*(?:T|(?:pukul|jam|waktu|time)\s*:?\s*)?(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?(?!\d)\s*(AM|PM)?/i;
const TIME_BEFORE = /(\d{1,2}):(\d{2})(?::\d{2})?\s*(?:WIB|WITA|WIT)?[\s,•|@\-/]*$/i;
const TIME_LABEL_BEFORE = /(?:pukul|jam|waktu|time)\s*:?\s*(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*[\s,•|@\-/]*$/i;

const pad = (n: number) => String(n).padStart(2, "0");

function validDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= dim;
}

function parseTime(h: string, mi: string, ap?: string): string | null {
  let hh = Number(h);
  const mm = Number(mi);
  if (mm > 59) return null;
  if (ap) {
    if (hh < 1 || hh > 12) return null;
    const pm = ap.toUpperCase() === "PM";
    hh = (hh % 12) + (pm ? 12 : 0);
  }
  if (hh > 23) return null;
  return `${pad(hh)}:${pad(mm)}`;
}

function year2(yy: string): { y: number; short: boolean } {
  return yy.length === 2 ? { y: 2000 + Number(yy), short: true } : { y: Number(yy), short: false };
}

export function findDates(
  line: string,
  opts: { order: DateOrder; today: Date },
): FoundDate[] {
  const todayUtc = Date.UTC(opts.today.getFullYear(), opts.today.getMonth(), opts.today.getDate());
  const found: FoundDate[] = [];
  let work = line;

  const emit = (
    start: number,
    end: number,
    y: number,
    m: number,
    d: number,
    base: number,
  ) => {
    if (y < 1990 || y > 2100 || !validDate(y, m, d)) return false;
    let conf = base;
    const days = (Date.UTC(y, m - 1, d) - todayUtc) / 86400000;
    if (days > 1) conf = Math.min(conf, 0.3);
    else if (days < -730) conf = Math.min(conf, 0.4);
    // time lookup on original line
    let time: string | null = null;
    const after = TIME_AFTER.exec(line.slice(end));
    if (after) time = parseTime(after[1]!, after[2]!, after[4]);
    if (!time) {
      const head = line.slice(0, start);
      const b = TIME_BEFORE.exec(head) ?? TIME_LABEL_BEFORE.exec(head);
      if (b) time = parseTime(b[1]!, b[2]!);
    }
    found.push({
      date: `${y}-${pad(m)}-${pad(d)}`,
      time,
      confidence: Math.round(conf * 100) / 100,
      start,
    });
    work = work.slice(0, start) + " ".repeat(end - start) + work.slice(end);
    return true;
  };

  for (const m of [...work.matchAll(TEXT_DMY)]) {
    const mon = MONTH_LOOKUP.get(m[2]!.toLowerCase());
    if (!mon) continue;
    const { y, short } = year2(m[3]!);
    emit(m.index!, m.index! + m[0].length, y, mon, Number(m[1]), short ? 0.8 : 0.95);
  }
  const snapshot = work;
  for (const m of [...snapshot.matchAll(TEXT_MDY)]) {
    if (work.slice(m.index!, m.index! + m[0].length) !== m[0]) continue;
    const mon = MONTH_LOOKUP.get(m[1]!.toLowerCase());
    if (!mon) continue;
    emit(m.index!, m.index! + m[0].length, Number(m[3]), mon, Number(m[2]), 0.95);
  }
  for (const m of [...work.matchAll(ISO)]) {
    if (work.slice(m.index!, m.index! + m[0].length) !== m[0]) continue;
    emit(m.index!, m.index! + m[0].length, Number(m[1]), Number(m[2]), Number(m[3]), 0.9);
  }
  for (const m of [...work.matchAll(NUMERIC)]) {
    if (work.slice(m.index!, m.index! + m[0].length) !== m[0]) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    const { y, short } = year2(m[3]!);
    const penalty = short ? 0.1 : 0;
    const dmyFirst = opts.order !== "MDY";
    const [d1, m1] = dmyFirst ? [a, b] : [b, a];
    const s = m.index!;
    const e = s + m[0].length;
    if (validDate(y, m1, d1)) emit(s, e, y, m1, d1, 0.85 - penalty);
    else if (validDate(y, d1, m1)) emit(s, e, y, d1, m1, 0.6 - penalty);
  }
  return found.sort((x, y) => x.start - y.start);
}
