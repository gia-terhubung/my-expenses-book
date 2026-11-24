import { createReceipt, listDraftIds } from "@/db/repositories/receipts";
import { listFolders } from "@/db/repositories/folders";
import { receipts } from "@/db/schema";
import { testDb } from "@/db/testing/testDb";
import { currencyExponent } from "@/money/currencies";

import { SHOT_LANGS, STORE_SHOTS, seedStoreShots } from "./storeShots";

const TODAY = "2026-11-24";

describe("store-shot datasets", () => {
  it.each(SHOT_LANGS)("%s reads as real life: no demo/test words in names, notes or folders", (lang) => {
    const d = STORE_SHOTS[lang];
    const words = [...d.receipts.map((r) => r.merchant), ...d.folders.flatMap((f) => [f.name, ...f.receipts.map((r) => r.merchant)])];
    for (const w of words) expect(w).not.toMatch(/demo|sample|fictional|test|contoh|fiktif|example|lorem/i);
  });

  it("each store uses its own language and home currency", () => {
    expect([STORE_SHOTS.en.home, STORE_SHOTS.id.home, STORE_SHOTS.es.home, STORE_SHOTS["pt-BR"].home]).toEqual([
      "USD",
      "IDR",
      "EUR",
      "BRL",
    ]);
    expect(STORE_SHOTS["pt-BR"].language).toBe("pt-BR");
  });

  it.each(SHOT_LANGS)("%s has a trip folder in a foreign currency and a project folder", (lang) => {
    const d = STORE_SHOTS[lang];
    const trip = d.folders.find((f) => f.kind === "trip")!;
    expect(trip.currency).not.toBe(d.home);
    expect(trip.rate).not.toBe(1);
    expect(d.folders.some((f) => f.kind === "project")).toBe(true);
  });
});

describe("seedStoreShots", () => {
  it("inserts the set: confirmed receipts, folders, one draft to review, all marked SS-", () => {
    const db = testDb();
    const r = seedStoreShots(db, "en", TODAY);
    const rows = db.select().from(receipts).all();
    expect(rows.length).toBe(r.inserted);
    expect(rows.every((x) => x.refNo?.startsWith("SS-"))).toBe(true);
    expect(listDraftIds(db)).toEqual([r.draftId]);
    expect(listFolders(db).map((f) => f.name).sort()).toEqual(STORE_SHOTS.en.folders.map((f) => f.name).sort());
  });

  it("converts trip receipts to the home currency with the dataset rate", () => {
    const db = testDb();
    seedStoreShots(db, "id", TODAY);
    const trip = STORE_SHOTS.id.folders.find((f) => f.kind === "trip")!;
    const row = db.select().from(receipts).all().find((x) => x.merchant === trip.receipts[0]!.merchant)!;
    const total = trip.receipts[0]!.total;
    expect(row.currency).toBe(trip.currency);
    expect(row.totalMinor).toBe(Math.round(total * 10 ** currencyExponent(trip.currency)));
    expect(row.amountHomeMinor).toBe(Math.round(total * trip.rate * 10 ** currencyExponent("IDR")));
    expect(row.fxRate).toBe(String(trip.rate));
  });

  it("puts most receipts in the current month so Home has a real total", () => {
    const db = testDb();
    seedStoreShots(db, "es", TODAY);
    const thisMonth = db.select().from(receipts).all().filter((x) => x.status === "confirmed" && x.purchasedAtLocal.startsWith("2026-11"));
    expect(thisMonth.length).toBeGreaterThanOrEqual(8);
    expect(thisMonth.every((x) => x.purchasedAtLocal.slice(0, 10) <= TODAY)).toBe(true);
  });

  it("fills the five months before this one, so the 6-month chart has no empty bars", () => {
    const db = testDb();
    seedStoreShots(db, "en", TODAY);
    const months = new Set(
      db.select().from(receipts).all().filter((x) => x.status === "confirmed" && !x.folderId).map((x) => x.purchasedAtLocal.slice(0, 7)),
    );
    expect([...months].sort()).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
  });

  it("dates the trip three months back, so last month is not inflated", () => {
    const db = testDb();
    const r = seedStoreShots(db, "id", TODAY);
    const trip = db.select().from(receipts).all().filter((x) => x.folderId === r.tripId);
    expect(trip.length).toBeGreaterThanOrEqual(7);
    expect(trip.every((x) => x.purchasedAtLocal.startsWith("2026-08"))).toBe(true);
  });

  it("returns the trip folder id so the shot can open it", () => {
    const db = testDb();
    const r = seedStoreShots(db, "en", TODAY);
    expect(listFolders(db).find((f) => f.id === r.tripId)?.name).toBe("Tokyo trip");
  });

  it("refuses to run when the database holds anyone's real receipts", () => {
    const db = testDb();
    createReceipt(db, {
      status: "confirmed",
      merchant: "Real shop",
      purchasedAtLocal: "2026-11-01T10:00:00",
      purchasedAtUtc: 0,
      scannedAtUtc: 0,
      currency: "IDR",
      totalMinor: 1000,
      parseSource: "manual",
    });
    expect(() => seedStoreShots(db, "en", TODAY)).toThrow(/real receipts/);
    expect(db.select().from(receipts).all()).toHaveLength(1);
  });

  it("running again for another language replaces the previous set", () => {
    const db = testDb();
    seedStoreShots(db, "en", TODAY);
    const r = seedStoreShots(db, "pt-BR", TODAY);
    const rows = db.select().from(receipts).all().filter((x) => x.deletedAt === null);
    expect(rows).toHaveLength(r.inserted);
    expect(rows.every((x) => x.homeCurrencyAtSave === "BRL" || x.status === "draft")).toBe(true);
    expect(listFolders(db).map((f) => f.name).sort()).toEqual(STORE_SHOTS["pt-BR"].folders.map((f) => f.name).sort());
  });
});
