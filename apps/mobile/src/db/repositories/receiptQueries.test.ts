import { testDb } from "../testing/testDb";
import type { NewReceiptInput } from "../types";
import { createFolder } from "./folders";
import {
  listCurrenciesInUse,
  listPurchaseMonths,
  listReceipts,
  monthTotals,
  sumHome,
  topMerchants,
  totalsByCategory,
  totalsByFolder,
} from "./receiptQueries";
import { createReceipt, softDeleteReceipt } from "./receipts";

function seed(db: ReturnType<typeof testDb>, over: Partial<NewReceiptInput> = {}) {
  return createReceipt(db, {
    merchant: "Toko",
    purchasedAtLocal: "2026-03-01T10:00:00",
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: 1772334000000,
    scannedAtUtc: 1772334060000,
    currency: "IDR",
    totalMinor: 1000,
    parseSource: "manual",
    status: "confirmed",
    ...over,
  });
}

const ids = (rs: { id: string }[]) => rs.map((r) => r.id);

describe("receipt queries", () => {
  it("excludes drafts and soft-deleted rows", () => {
    const db = testDb();
    seed(db, { status: "draft" });
    const del = seed(db);
    softDeleteReceipt(db, del.id);
    const a = seed(db, { purchasedAtLocal: "2026-03-02T10:00:00" });
    const b = seed(db, { purchasedAtLocal: "2026-03-03T10:00:00" });
    expect(ids(listReceipts(db, {}, { limit: 50 }))).toEqual([b.id, a.id]);
  });

  it("orders by purchased_at_local desc then id desc and pages by keyset", () => {
    const db = testDb();
    const all = new Set<string>();
    for (let i = 0; i < 120; i++) {
      const local = i < 30 ? "2026-05-05T12:00:00" : `2026-04-${String((i % 28) + 1).padStart(2, "0")}T${String(i % 24).padStart(2, "0")}:00:00`;
      all.add(seed(db, { purchasedAtLocal: local }).id);
    }
    const seen: string[] = [];
    const sizes: number[] = [];
    let after: { purchasedAtLocal: string; id: string } | undefined;
    for (;;) {
      const rows = listReceipts(db, {}, { limit: 50, after });
      if (rows.length === 0) break;
      sizes.push(rows.length);
      seen.push(...ids(rows));
      const last = rows[rows.length - 1];
      after = { purchasedAtLocal: last.purchasedAtLocal, id: last.id };
    }
    expect(sizes).toEqual([50, 50, 20]);
    expect(new Set(seen).size).toBe(120);
    expect(new Set(seen)).toEqual(all);
    const first30 = seen.slice(0, 30);
    expect(first30).toEqual([...first30].sort().reverse());
  });

  it("date range is inclusive on local wall-clock date", () => {
    const db = testDb();
    seed(db, { purchasedAtLocal: "2026-03-31T23:30:00", purchasedTz: "Asia/Jakarta", purchasedAtUtc: Date.UTC(2026, 2, 31, 16, 30) });
    const b = seed(db, { purchasedAtLocal: "2026-04-01T00:10:00", purchasedAtUtc: Date.UTC(2026, 2, 31, 17, 10) });
    const c = seed(db, { purchasedAtLocal: "2027-03-31T23:59:59" });
    seed(db, { purchasedAtLocal: "2027-04-01T00:00:00" });
    expect(ids(listReceipts(db, { from: "2026-04-01", to: "2027-03-31" }, { limit: 50 }))).toEqual([c.id, b.id]);
  });

  it("filters by category any-of, folder id, no-folder (null) and currency", () => {
    const db = testDb();
    const f = createFolder(db, { name: "Trip", kind: "trip" });
    const a = seed(db, { categoryId: "c1", folderId: f.id, currency: "EUR", purchasedAtLocal: "2026-03-01T01:00:00" });
    const b = seed(db, { categoryId: "c2", purchasedAtLocal: "2026-03-01T02:00:00" });
    const c = seed(db, { categoryId: "c3", purchasedAtLocal: "2026-03-01T03:00:00" });
    const q = (filter: object) => ids(listReceipts(db, filter, { limit: 50 }));
    expect(q({ categoryIds: ["c1", "c2"] })).toEqual([b.id, a.id]);
    expect(q({ categoryIds: [] })).toHaveLength(3);
    expect(q({ folderId: f.id })).toEqual([a.id]);
    expect(q({ folderId: null })).toEqual([c.id, b.id]);
    expect(q({ currency: "EUR" })).toEqual([a.id]);
    expect(q({ categoryIds: ["c1", "c2"], folderId: null, currency: "IDR" })).toEqual([b.id]);
  });

  it("text search intersects with filters", () => {
    const db = testDb();
    const p = seed(db, { merchant: "Indomaret Point", categoryId: "A" });
    seed(db, { merchant: "Indomaret Express", categoryId: "B" });
    expect(ids(listReceipts(db, { text: "indom", categoryIds: ["A"] }, { limit: 50 }))).toEqual([p.id]);
  });

  it("text search tolerates operators, quotes and diacritics", () => {
    const db = testDb();
    const r = seed(db, { merchant: "Café Lumière" });
    for (const text of ['"', "AND", "-*"]) {
      expect(listReceipts(db, { text }, { limit: 50 })).toEqual([]);
    }
    for (const text of ["café", "cafe"]) {
      expect(ids(listReceipts(db, { text }, { limit: 50 }))).toEqual([r.id]);
    }
  });

  it("sumHome never mixes currencies", () => {
    const db = testDb();
    seed(db, { totalMinor: 10000, homeCurrencyAtSave: "IDR", amountHomeMinor: 10000 });
    seed(db, { currency: "EUR", totalMinor: 1000, homeCurrencyAtSave: "IDR", amountHomeMinor: 170000 });
    seed(db, { currency: "EUR", totalMinor: 1000, homeCurrencyAtSave: "IDR", amountHomeMinor: null });
    seed(db, { currency: "USD", totalMinor: 500, homeCurrencyAtSave: "USD", amountHomeMinor: 500 });
    expect(sumHome(db, {}, "IDR")).toEqual({ homeMinor: 180000, count: 4, unconverted: 2 });
    expect(sumHome(db, { currency: "NOPE" }, "IDR")).toEqual({ homeMinor: 0, count: 0, unconverted: 0 });
  });

  it("monthTotals groups by local month", () => {
    const db = testDb();
    seed(db, { purchasedAtLocal: "2026-10-31T23:50:00", homeCurrencyAtSave: "IDR", amountHomeMinor: 100 });
    seed(db, { purchasedAtLocal: "2026-11-01T00:10:00", homeCurrencyAtSave: "IDR", amountHomeMinor: 200 });
    seed(db, { purchasedAtLocal: "2026-11-05T09:00:00" });
    const t = monthTotals(db, {}, "IDR");
    expect(Object.keys(t)).toEqual(["2026-11", "2026-10"]);
    expect(t["2026-11"]).toEqual({ homeMinor: 200, count: 2, unconverted: 1 });
    expect(t["2026-10"]).toEqual({ homeMinor: 100, count: 1, unconverted: 0 });
  });

  it("listPurchaseMonths and listCurrenciesInUse ignore drafts and deleted rows", () => {
    const db = testDb();
    seed(db, { purchasedAtLocal: "2026-02-01T00:00:00", currency: "IDR" });
    seed(db, { purchasedAtLocal: "2026-03-01T00:00:00", currency: "EUR" });
    seed(db, { purchasedAtLocal: "2026-03-09T00:00:00", currency: "EUR" });
    seed(db, { purchasedAtLocal: "2025-01-01T00:00:00", currency: "JPY", status: "draft" });
    const del = seed(db, { purchasedAtLocal: "2024-01-01T00:00:00", currency: "USD" });
    softDeleteReceipt(db, del.id);
    expect(listPurchaseMonths(db)).toEqual(["2026-03", "2026-02"]);
    expect(listCurrenciesInUse(db)).toEqual(["EUR", "IDR"]);
  });
  it("totalsByCategory groups, keeps null as its own row and orders by homeMinor desc", () => {
    const db = testDb();
    const home = { homeCurrencyAtSave: "IDR", amountHomeMinor: 100 };
    seed(db, { ...home, categoryId: "default:food", amountHomeMinor: 300 });
    seed(db, { ...home, categoryId: "default:food", amountHomeMinor: 200 });
    seed(db, { ...home, categoryId: "default:other", amountHomeMinor: 100 });
    seed(db, { ...home, categoryId: null, amountHomeMinor: 900 });
    seed(db, { categoryId: "default:food", currency: "USD" });
    const rows = totalsByCategory(db, {}, "IDR");
    expect(rows.map((r) => r.categoryId)).toEqual([null, "default:food", "default:other"]);
    expect(rows[1]!.total).toEqual({ homeMinor: 500, count: 3, unconverted: 1 });
  });

  it("unconvertedFor matches other home currencies and null amounts only", () => {
    const db = testDb();
    const ok = seed(db, { homeCurrencyAtSave: "IDR", amountHomeMinor: 100 });
    const otherHome = seed(db, { homeCurrencyAtSave: "USD", amountHomeMinor: 100 });
    const noAmount = seed(db, { homeCurrencyAtSave: "IDR" });
    const noHome = seed(db);
    const got = ids(listReceipts(db, { unconvertedFor: "IDR" }, { limit: 50 }));
    expect(got.sort()).toEqual([otherHome.id, noAmount.id, noHome.id].sort());
    expect(got).not.toContain(ok.id);
  });

  it("topMerchants respects limit and orders by homeMinor desc", () => {
    const db = testDb();
    const h = { homeCurrencyAtSave: "IDR" };
    seed(db, { ...h, merchant: "A", amountHomeMinor: 100 });
    seed(db, { ...h, merchant: "B", amountHomeMinor: 500 });
    seed(db, { ...h, merchant: "B", amountHomeMinor: 100 });
    seed(db, { ...h, merchant: "C", amountHomeMinor: 300 });
    const rows = topMerchants(db, {}, "IDR", 2);
    expect(rows.map((r) => r.merchant)).toEqual(["B", "C"]);
    expect(rows[0]!.total.count).toBe(2);
  });

  it("totalsByFolder only includes rows with a folder", () => {
    const db = testDb();
    const f1 = createFolder(db, { name: "Trip", kind: "trip" });
    const f2 = createFolder(db, { name: "Proj", kind: "project" });
    const h = { homeCurrencyAtSave: "IDR" };
    seed(db, { ...h, amountHomeMinor: 999 });
    seed(db, { ...h, amountHomeMinor: 100, folderId: f1.id });
    seed(db, { ...h, amountHomeMinor: 400, folderId: f2.id });
    const rows = totalsByFolder(db, {}, "IDR");
    expect(rows.map((r) => r.folderId)).toEqual([f2.id, f1.id]);
    expect(rows[0]!.total.homeMinor).toBe(400);
  });
});
