// Dev-only: the data behind the App Store / Play Store screenshots, one set per store language.
// Shops are invented but local to each country (no real brands), amounts and tax follow local
// practice. Every row is marked with a refNo starting "SS-" so a reset only removes this set.
import { inArray, like } from "drizzle-orm";

import { notifyDataChanged } from "@/db/changes";
import { newId } from "@/db/ids";
import { createFolder } from "@/db/repositories/folders";
import { folders, receiptPages, receipts } from "@/db/schema";
import type { AppDb } from "@/db/types";
import type { Language } from "@/prefs/prefs";
import { currencyExponent } from "@/money/currencies";

import slips from "./storeShotSlips.json";

export const SHOT_LANGS = ["en", "id", "es", "pt-BR"] as const;
export type ShotLang = (typeof SHOT_LANGS)[number];

type Line = { merchant: string; total: number; category: string; tax?: number };
type ShotFolder = {
  name: string;
  kind: "trip" | "project";
  /** Receipt currency; the home currency for a project. */
  currency: string;
  /** Home units per 1 receipt unit (1 for a project in the home currency). */
  rate: number;
  tz: string;
  receipts: Line[];
};
export type ShotSet = {
  language: Language;
  home: string;
  tz: string;
  /** This month, newest first. Earlier months reuse the first lines at other amounts. */
  receipts: Line[];
  folders: ShotFolder[];
  /** The receipt waiting for review; its photo is rendered from storeShotSlips.json. */
  draft: Line & { time: string };
};

const C = (k: string) => `default:${k}`;

export const STORE_SHOTS: Record<ShotLang, ShotSet> = {
  en: {
    language: "en",
    home: "USD",
    tz: "America/New_York",
    receipts: [
      { merchant: "Blue Door Coffee", total: 6.75, category: C("food_drink") },
      { merchant: "Northside Market", total: 84.32, category: C("groceries"), tax: 2.41 },
      { merchant: "Citywide Transit", total: 2.9, category: C("transport") },
      { merchant: "Greenleaf Pharmacy", total: 18.49, category: C("health") },
      { merchant: "Harbor Diner", total: 42.6, category: C("food_drink"), tax: 3.78 },
      { merchant: "Paper & Pen Supply", total: 27.15, category: C("office"), tax: 2.41 },
      { merchant: "Sunset Cinema", total: 31, category: C("entertainment") },
      { merchant: "Brightline Electric", total: 96.4, category: C("utilities") },
      { merchant: "Maple Street Bakery", total: 9.25, category: C("food_drink") },
      { merchant: "Quick Lube Auto", total: 54.99, category: C("transport"), tax: 4.88 },
    ],
    folders: [
      {
        name: "Tokyo trip",
        kind: "trip",
        currency: "JPY",
        rate: 0.0064,
        tz: "Asia/Tokyo",
        receipts: [
          { merchant: "Ramen Kazu", total: 1480, category: C("food_drink") },
          { merchant: "Konbini Hikari", total: 865, category: C("groceries") },
          { merchant: "Sushi Mori", total: 6200, category: C("food_drink") },
          { merchant: "Hotel Aoi Shinjuku", total: 18700, category: C("lodging") },
        ],
      },
      {
        name: "Kitchen remodel",
        kind: "project",
        currency: "USD",
        rate: 1,
        tz: "America/New_York",
        receipts: [{ merchant: "Hillside Hardware", total: 212.45, category: C("shopping"), tax: 18.86 }],
      },
    ],
    draft: { merchant: "Fresh Fields Market", total: 63.18, tax: 4.92, category: C("groceries"), time: "18:42" },
  },
  id: {
    language: "id",
    home: "IDR",
    tz: "Asia/Jakarta",
    receipts: [
      { merchant: "Kopi Senja", total: 32000, category: C("food_drink") },
      { merchant: "Pasar Segar Swalayan", total: 243600, category: C("groceries"), tax: 24140 },
      { merchant: "Ojek Kilat", total: 18000, category: C("transport") },
      { merchant: "Apotek Sehat Sentosa", total: 64300, category: C("health") },
      { merchant: "Bakmi Ayam Pak Darto", total: 38000, category: C("food_drink") },
      { merchant: "Toko Buku Pelita", total: 125000, category: C("shopping") },
      { merchant: "Bioskop Mutiara", total: 50000, category: C("entertainment") },
      { merchant: "Token Listrik", total: 202500, category: C("utilities") },
      { merchant: "Warung Bu Tini", total: 25000, category: C("food_drink") },
      { merchant: "Bengkel Motor Jaya", total: 85000, category: C("transport") },
    ],
    folders: [
      {
        name: "Liburan Singapura",
        kind: "trip",
        currency: "SGD",
        rate: 12300,
        tz: "Asia/Singapore",
        receipts: [
          { merchant: "Kopitiam Ah Seng", total: 7.8, category: C("food_drink") },
          { merchant: "Hawker Makan Sedap", total: 12.5, category: C("food_drink") },
          { merchant: "Kedai Kaya Toast", total: 6.4, category: C("food_drink") },
          { merchant: "Hotel Merlin Bay", total: 186, category: C("lodging") },
        ],
      },
      {
        name: "Renovasi dapur",
        kind: "project",
        currency: "IDR",
        rate: 1,
        tz: "Asia/Jakarta",
        receipts: [{ merchant: "Toko Bangunan Makmur", total: 1450000, category: C("shopping"), tax: 143694 }],
      },
    ],
    draft: { merchant: "Toko Sumber Rejeki", total: 187500, tax: 18581, category: C("groceries"), time: "19:05" },
  },
  es: {
    language: "es",
    home: "EUR",
    tz: "Europe/Madrid",
    receipts: [
      { merchant: "Cafetería El Rincón", total: 3.8, category: C("food_drink") },
      { merchant: "Supermercado La Plaza", total: 46.72, category: C("groceries"), tax: 4.25 },
      { merchant: "Radio Taxi Sur", total: 14.8, category: C("transport") },
      { merchant: "Farmacia Central", total: 12.35, category: C("health") },
      { merchant: "Bar Los Arcos", total: 18.5, category: C("food_drink"), tax: 1.68 },
      { merchant: "Papelería Sol", total: 7.9, category: C("office"), tax: 1.37 },
      { merchant: "Cine Avenida", total: 9.5, category: C("entertainment") },
      { merchant: "Luz y Gas Levante", total: 74.3, category: C("utilities") },
      { merchant: "Panadería San Antón", total: 4.6, category: C("food_drink") },
      { merchant: "Gasolinera Ruta 6", total: 52.1, category: C("transport"), tax: 9.04 },
    ],
    folders: [
      {
        name: "Viaje a Londres",
        kind: "trip",
        currency: "GBP",
        rate: 1.17,
        tz: "Europe/London",
        receipts: [
          { merchant: "The Red Lion", total: 24.6, category: C("food_drink") },
          { merchant: "Camden Corner Café", total: 8.4, category: C("food_drink") },
          { merchant: "Borough Deli", total: 11.2, category: C("food_drink") },
          { merchant: "Kensington Rose Hotel", total: 162, category: C("lodging") },
        ],
      },
      {
        name: "Reforma de la cocina",
        kind: "project",
        currency: "EUR",
        rate: 1,
        tz: "Europe/Madrid",
        receipts: [{ merchant: "Ferretería El Clavo", total: 128.4, category: C("shopping"), tax: 22.28 }],
      },
    ],
    draft: { merchant: "Frutería La Huerta", total: 23.45, tax: 0.9, category: C("groceries"), time: "19:20" },
  },
  "pt-BR": {
    language: "pt-BR",
    home: "BRL",
    tz: "America/Sao_Paulo",
    receipts: [
      { merchant: "Padaria Pão Quente", total: 14.9, category: C("food_drink") },
      { merchant: "Mercado Bom Preço", total: 237.45, category: C("groceries") },
      { merchant: "Táxi Rápido", total: 27.5, category: C("transport") },
      { merchant: "Farmácia Vida", total: 46.8, category: C("health") },
      { merchant: "Lanchonete Sabor da Casa", total: 32, category: C("food_drink") },
      { merchant: "Livraria Central", total: 59.9, category: C("shopping") },
      { merchant: "Cine Paradiso", total: 38, category: C("entertainment") },
      { merchant: "Energia Sul", total: 162.3, category: C("utilities") },
      { merchant: "Açaí da Praia", total: 22, category: C("food_drink") },
      { merchant: "Posto Estrela", total: 180, category: C("transport") },
    ],
    folders: [
      {
        name: "Viagem a Buenos Aires",
        kind: "trip",
        currency: "ARS",
        rate: 0.0056,
        tz: "America/Argentina/Buenos_Aires",
        receipts: [
          { merchant: "Parrilla La Esquina", total: 48500, category: C("food_drink") },
          { merchant: "Café de la Plaza", total: 12800, category: C("food_drink") },
          { merchant: "Heladería Lucía", total: 6400, category: C("food_drink") },
          { merchant: "Hotel Recoleta Sur", total: 95000, category: C("lodging") },
        ],
      },
      {
        name: "Reforma da cozinha",
        kind: "project",
        currency: "BRL",
        rate: 1,
        tz: "America/Sao_Paulo",
        receipts: [{ merchant: "Casa de Materiais Silva", total: 389.9, category: C("shopping") }],
      },
    ],
    draft: { merchant: "Hortifruti Verde", total: 41.25, category: C("groceries"), time: "18:55" },
  },
};

/** Standard-time UTC offsets in hours, enough for believable timestamps in dev data. */
const OFFSET: Record<string, number> = {
  "America/New_York": -5,
  "Asia/Jakarta": 7,
  "Europe/Madrid": 1,
  "America/Sao_Paulo": -3,
  "Asia/Tokyo": 9,
  "Asia/Singapore": 8,
  "Europe/London": 0,
  "America/Argentina/Buenos_Aires": -3,
};

const pad = (n: number) => String(n).padStart(2, "0");
const minor = (v: number, cur: string) => Math.round(v * 10 ** currencyExponent(cur));

function stamp(day: string, time: string, tz: string) {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  return { local: `${day}T${time}:00`, utc: Date.UTC(y, m - 1, d, hh, mm) - (OFFSET[tz] ?? 0) * 3_600_000 };
}

/** `today` shifted by whole months back, day clamped to `day` (1-based). */
function dayIn(today: string, monthsBack: number, day: number): string {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const dt = new Date(Date.UTC(y, m - 1 - monthsBack, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(Math.min(day, last))}`;
}

const TIMES = ["08:12", "12:40", "17:55", "09:30", "13:05", "19:22", "10:48", "20:10", "07:58", "15:34"];

export class RealDataError extends Error {}

/**
 * Seeds one language's store-shot set and returns what it made. Refuses when the database holds
 * receipts that are not from a previous store-shot run, so it can never touch a real user's data.
 * The caller sets prefs (language, home currency, onboarding done) and attaches the draft's photo.
 */
export function seedStoreShots(db: AppDb, lang: ShotLang, today: string): { inserted: number; draftId: string } {
  const set = STORE_SHOTS[lang];
  const real = db.select({ id: receipts.id, refNo: receipts.refNo }).from(receipts).all();
  if (real.some((r) => !r.refNo?.startsWith("SS-"))) {
    throw new RealDataError("Store-shot seed refused: the database has real receipts. Use a fresh simulator install.");
  }
  const todayDay = Number(today.slice(8, 10));
  let n = 0;
  let draftId = "";

  db.transaction((tx) => {
    const old = tx.select({ id: receipts.id }).from(receipts).where(like(receipts.refNo, "SS-%")).all().map((r) => r.id);
    if (old.length) {
      tx.delete(receiptPages).where(inArray(receiptPages.receiptId, old)).run();
      tx.delete(receipts).where(inArray(receipts.id, old)).run();
    }
    const allNames = SHOT_LANGS.flatMap((l) => STORE_SHOTS[l].folders.map((f) => f.name));
    tx.delete(folders).where(inArray(folders.name, allNames)).run();
  });

  const insert = (
    l: Line,
    o: { day: string; time: string; tz: string; currency: string; rate: number; folderId?: string; status?: "draft" },
  ) => {
    const { local, utc } = stamp(o.day, o.time, o.tz);
    const totalMinor = minor(l.total, o.currency);
    const home = o.currency === set.home;
    const id = newId();
    db.insert(receipts)
      .values({
        id,
        createdAt: utc,
        updatedAt: utc,
        merchant: l.merchant,
        purchasedAtLocal: local,
        purchasedTz: o.tz,
        purchasedAtUtc: utc,
        scannedAtUtc: utc,
        scannedTz: o.tz,
        currency: o.currency,
        totalMinor,
        taxMinor: l.tax === undefined ? null : minor(l.tax, o.currency),
        homeCurrencyAtSave: set.home,
        amountHomeMinor: home ? totalMinor : minor(l.total * o.rate, set.home),
        fxRate: home ? null : String(o.rate),
        fxRateDate: home ? null : o.day,
        fxApproximate: false,
        categoryId: l.category,
        folderId: o.folderId ?? null,
        refNo: `SS-${lang}-${n}`,
        parseSource: o.status === "draft" ? "heuristic" : "manual",
        parseConfidence:
          o.status === "draft"
            ? JSON.stringify({ merchant: 0.95, date: 0.95, total: 0.95, tax: 0.95, currency: 0.95, category: 0.9 })
            : null,
        rawOcrText: o.status === "draft" ? (slips as Record<string, string[]>)[lang]!.join("\n") : null,
        status: o.status ?? "confirmed",
      })
      .run();
    n++;
    return id;
  };

  // This month: one receipt every couple of days up to today, newest first.
  set.receipts.forEach((l, i) => {
    const day = dayIn(today, 0, Math.max(1, todayDay - Math.round((i * (todayDay - 1)) / set.receipts.length)));
    insert(l, { day, time: TIMES[i % TIMES.length]!, tz: set.tz, currency: set.home, rate: 1 });
  });
  // Two earlier months at other amounts, so Statistics has a trend.
  [1, 2].forEach((back) =>
    set.receipts.slice(0, 7 - back).forEach((l, i) => {
      const total = Number((l.total * (back === 1 ? 1.12 : 0.86)).toFixed(currencyExponent(set.home)));
      insert({ ...l, total }, { day: dayIn(today, back, 3 + i * 4), time: TIMES[(i + back) % TIMES.length]!, tz: set.tz, currency: set.home, rate: 1 });
    }),
  );
  for (const f of set.folders) {
    const folder = createFolder(db, { name: f.name, kind: f.kind, ...(f.currency === set.home ? {} : { defaultCurrency: f.currency }) });
    f.receipts.forEach((l, i) =>
      insert(l, { day: dayIn(today, 1, 10 + i), time: TIMES[(i + 3) % TIMES.length]!, tz: f.tz, currency: f.currency, rate: f.rate, folderId: folder.id }),
    );
  }
  draftId = insert(set.draft, { day: today, time: set.draft.time, tz: set.tz, currency: set.home, rate: 1, status: "draft" });

  notifyDataChanged();
  return { inserted: n, draftId };
}
