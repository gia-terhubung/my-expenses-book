// Dev-only: fully synthetic, deterministic receipts for acceptance runs. Invented merchants only.
import { notifyDataChanged } from "@/db/changes";
import { newId } from "@/db/ids";
import { createFolder } from "@/db/repositories/folders";
import { receipts } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { currencyExponent } from "@/money/currencies";

export type SeedOptions = {
  /** Home currency, ISO upper-case. */
  home: string;
  seed: number;
  /** Local "YYYY-MM-DD"; receipts span the 18 months up to this day. */
  today: string;
};

const MERCHANTS = [
  "Warung Kopi Contoh",
  "Indomaret Sample",
  "Toko Sinar Fiktif",
  "Bluebird Demo Cab",
  "Cafe Nusantara Test",
  "Pasar Mini Imajiner",
  "Demo Pharmacy",
  "Acme Office Supply",
  "Maple Grocer Example",
  "Harbor Hotel Fictional",
  "Sakura Ramen Sample",
  "Cinema Contoh XXI",
  "Listrik Demo Utility",
  "Fiktif Books",
];
const CATEGORIES = [
  "default:food_drink",
  "default:transport",
  "default:lodging",
  "default:groceries",
  "default:shopping",
  "default:utilities",
  "default:health",
  "default:office",
  "default:entertainment",
  "default:other",
  "default:transfer",
];
const FOLDERS: { name: string; kind: "project" | "trip" }[] = [
  { name: "Demo Project Alpha", kind: "project" },
  { name: "Demo Trip Bali", kind: "trip" },
  { name: "Demo Project Beta", kind: "project" },
];
// Foreign currency -> units of home per 1 unit, only used for IDR home; others use 1:1 style fallbacks.
const RATES: Record<string, number> = { IDR: 1, USD: 16000, EUR: 17500, JPY: 105 };
// Typical whole-unit amount ranges per currency.
const RANGE: Record<string, [number, number]> = {
  IDR: [8000, 900000],
  USD: [2, 120],
  EUR: [2, 110],
  JPY: [200, 15000],
};
const CURRENCY_MIX = ["IDR", "IDR", "IDR", "IDR", "USD", "EUR", "JPY"];

/** mulberry32: small deterministic PRNG. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Inserts n confirmed receipts and 3 folders. Returns n. */
export function seedSyntheticReceipts(db: AppDb, n: number, opts: SeedOptions): number {
  const rnd = prng(opts.seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const folders = FOLDERS.map((f) => createFolder(db, f));
  const [y, m, d] = opts.today.split("-").map(Number) as [number, number, number];
  const todayMs = Date.UTC(y, m - 1, d);
  const spanDays = 548; // about 18 months
  const homeExp = currencyExponent(opts.home);
  const base = Date.now();

  db.transaction((tx) => {
    for (let i = 0; i < n; i++) {
      const currency = pick(CURRENCY_MIX);
      const [lo, hi] = RANGE[currency]!;
      const exp = currencyExponent(currency);
      const whole = lo + Math.floor(rnd() * (hi - lo));
      const totalMinor = whole * 10 ** exp + (exp > 0 ? Math.floor(rnd() * 100) : 0);
      const dayMs = todayMs - Math.floor(rnd() * spanDays) * 86400000;
      const dt = new Date(dayMs);
      const hh = 7 + Math.floor(rnd() * 15);
      const mm = Math.floor(rnd() * 60);
      const local = `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}T${pad(hh)}:${pad(mm)}:00`;
      const utc = dayMs + (hh * 60 + mm) * 60000;
      const rate = RATES[currency];
      const rateOk = rate !== undefined && opts.home === "IDR";
      // About 1 in 12 foreign receipts stays unconverted (as if saved offline).
      const unconverted = currency !== opts.home && (!rateOk || rnd() < 0.09);
      const sameHome = currency === opts.home;
      const homeMinor = sameHome
        ? totalMinor
        : unconverted
          ? null
          : Math.round((totalMinor / 10 ** exp) * rate! * 10 ** homeExp);
      const hasFolder = rnd() < 0.4;
      tx.insert(receipts)
        .values({
          id: newId(),
          createdAt: base + i,
          updatedAt: base + i,
          merchant: pick(MERCHANTS),
          purchasedAtLocal: local,
          purchasedTz: "Asia/Jakarta",
          purchasedAtUtc: utc,
          scannedAtUtc: utc,
          currency,
          totalMinor,
          homeCurrencyAtSave: homeMinor === null ? null : opts.home,
          amountHomeMinor: homeMinor,
          fxRate: sameHome || homeMinor === null ? null : String(rate),
          fxRateDate: sameHome || homeMinor === null ? null : local.slice(0, 10),
          fxApproximate: false,
          categoryId: pick(CATEGORIES),
          folderId: hasFolder ? pick(folders).id : null,
          parseSource: "manual",
          status: "confirmed",
        })
        .run();
    }
  });
  notifyDataChanged();
  return n;
}
