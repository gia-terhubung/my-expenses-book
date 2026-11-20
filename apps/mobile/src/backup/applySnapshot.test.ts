import { categories, folders, lineItems, receiptPages, receipts } from "@/db/schema";
import { searchReceipts } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb, Category, Folder, LineItem, Receipt, ReceiptPage } from "@/db/types";

import { applyMerge, applyReplace } from "./applySnapshot";
import { SCHEMA_VERSION, type Snapshot } from "./snapshot";

const T0 = 1_772_334_000_000;

function receiptRow(id: string, over: Partial<Receipt> = {}): Receipt {
  return {
    id,
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    version: 1,
    merchant: `Merchant ${id}`,
    purchasedAtLocal: "2026-03-01T10:00:00",
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: T0,
    scannedAtUtc: T0,
    scannedTz: "Asia/Jakarta",
    currency: "IDR",
    totalMinor: 12500,
    taxMinor: null,
    fxRate: "1",
    fxRateDate: "2026-03-01",
    homeCurrencyAtSave: "IDR",
    amountHomeMinor: 12500,
    fxApproximate: false,
    categoryId: null,
    folderId: null,
    notes: null,
    refNo: null,
    rawOcrText: null,
    recurringRuleId: null,
    recurringDate: null,
    parseSource: "manual",
    parseConfidence: null,
    status: "confirmed",
    ...over,
  };
}

const syncBase = (id: string) => ({ id, createdAt: T0, updatedAt: T0, deletedAt: null, version: 1 });

const folderRow = (id: string, over: Partial<Folder> = {}): Folder => ({
  ...syncBase(id),
  name: `Folder ${id}`,
  kind: "trip",
  defaultCurrency: null,
  ...over,
});
const categoryRow = (id: string, over: Partial<Category> = {}): Category => ({
  ...syncBase(id),
  nameKey: null,
  customName: `Cat ${id}`,
  icon: null,
  color: "#123456",
  isDefault: false,
  sortOrder: 500,
  ...over,
});
const pageRow = (id: string, receiptId: string, over: Partial<ReceiptPage> = {}): ReceiptPage => ({
  ...syncBase(id),
  receiptId,
  pageIndex: 0,
  imagePath: `pages/${id}.enc`,
  thumbPath: null,
  width: 10,
  height: 10,
  dhash: null,
  ...over,
});
const lineRow = (id: string, receiptId: string, over: Partial<LineItem> = {}): LineItem => ({
  ...syncBase(id),
  receiptId,
  description: "Item",
  qty: 1,
  amountMinor: 100,
  ...over,
});

function snap(over: Partial<Snapshot> = {}): Snapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    prefs: { homeCurrency: "IDR", taxYearStartMonth: 1 },
    categories: [],
    folders: [],
    receipts: [],
    receiptPages: [],
    lineItems: [],
    ...over,
  };
}

function insertLocal(db: AppDb, s: Partial<Snapshot>) {
  if (s.categories?.length) db.insert(categories).values(s.categories).run();
  if (s.folders?.length) db.insert(folders).values(s.folders).run();
  if (s.receipts?.length) db.insert(receipts).values(s.receipts).run();
  if (s.receiptPages?.length) db.insert(receiptPages).values(s.receiptPages).run();
  if (s.lineItems?.length) db.insert(lineItems).values(s.lineItems).run();
}

const all = (db: AppDb) => ({
  categories: db.select().from(categories).all(),
  folders: db.select().from(folders).all(),
  receipts: db.select().from(receipts).all(),
  receiptPages: db.select().from(receiptPages).all(),
  lineItems: db.select().from(lineItems).all(),
});
const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
const receiptById = (db: AppDb, id: string) => all(db).receipts.find((r) => r.id === id);

describe("applyReplace", () => {
  it("leaves exactly the snapshot rows and rebuilds FTS", () => {
    const db = testDb();
    insertLocal(db, {
      receipts: [receiptRow("local-only", { merchant: "Local Shop" })],
      receiptPages: [pageRow("lp", "local-only")],
    });
    const s = snap({
      categories: [categoryRow("cat-1")],
      folders: [folderRow("f-1")],
      receipts: [receiptRow("r-1", { merchant: "Warung Sederhana", folderId: "f-1", categoryId: "cat-1" })],
      receiptPages: [pageRow("p-1", "r-1")],
      lineItems: [lineRow("l-1", "r-1")],
    });
    applyReplace(db, s);
    const got = all(db);
    expect(byId(got.categories)).toEqual(s.categories); // default categories wiped too
    expect(got.folders).toEqual(s.folders);
    expect(got.receipts).toEqual(s.receipts);
    expect(got.receiptPages).toEqual(s.receiptPages);
    expect(got.lineItems).toEqual(s.lineItems);
    expect(searchReceipts(db, "Sederhana").map((r) => r.id)).toEqual(["r-1"]);
    expect(searchReceipts(db, "Local")).toEqual([]);
  });

  it("rolls back entirely when an insert fails", () => {
    const db = testDb();
    insertLocal(db, { receipts: [receiptRow("keep")] });
    const before = all(db);
    const s = snap({ receipts: [receiptRow("dup"), receiptRow("dup")] });
    expect(() => applyReplace(db, s)).toThrow();
    expect(all(db)).toEqual(before);
  });
});

describe("applyMerge", () => {
  it("inserts new ids", () => {
    const db = testDb();
    insertLocal(db, { receipts: [receiptRow("a")] });
    const res = applyMerge(db, snap({ receipts: [receiptRow("b")], lineItems: [lineRow("l-b", "b")] }));
    expect(res).toEqual({ inserted: 1, updated: 0, kept: 0, insertedReceiptIds: ["b"] });
    expect(all(db).receipts.map((r) => r.id).sort()).toEqual(["a", "b"]);
    expect(all(db).lineItems.map((l) => l.id)).toEqual(["l-b"]);
  });

  it("updates when the snapshot row is newer, keeps local when older, keeps local on full tie", () => {
    const db = testDb();
    insertLocal(db, {
      receipts: [
        receiptRow("newer", { merchant: "old", updatedAt: T0 }),
        receiptRow("older", { merchant: "local", updatedAt: T0 + 10 }),
        receiptRow("tie", { merchant: "local tie", updatedAt: T0, version: 2 }),
        receiptRow("ver", { merchant: "local ver", updatedAt: T0, version: 1 }),
      ],
    });
    const res = applyMerge(
      db,
      snap({
        receipts: [
          receiptRow("newer", { merchant: "Fresh Mart", updatedAt: T0 + 5 }),
          receiptRow("older", { merchant: "stale", updatedAt: T0 }),
          receiptRow("tie", { merchant: "snap tie", updatedAt: T0, version: 2 }),
          receiptRow("ver", { merchant: "snap ver", updatedAt: T0, version: 3 }),
        ],
      }),
    );
    expect(res).toEqual({ inserted: 0, updated: 2, kept: 2, insertedReceiptIds: [] });
    expect(receiptById(db, "newer")?.merchant).toBe("Fresh Mart");
    expect(receiptById(db, "older")?.merchant).toBe("local");
    expect(receiptById(db, "tie")?.merchant).toBe("local tie");
    expect(receiptById(db, "ver")?.merchant).toBe("snap ver");
    // FTS follows the merged state
    expect(searchReceipts(db, "Fresh").map((r) => r.id)).toEqual(["newer"]);
    expect(searchReceipts(db, "old")).toEqual([]);
  });

  it("applies the rule to every table", () => {
    const db = testDb();
    insertLocal(db, {
      folders: [folderRow("f", { name: "Local folder" })],
      receipts: [receiptRow("r")],
      receiptPages: [pageRow("p", "r", { imagePath: "pages/local.enc" })],
      lineItems: [lineRow("l", "r", { description: "keep me", updatedAt: T0 + 9 })],
    });
    applyMerge(
      db,
      snap({
        folders: [folderRow("f", { name: "Snap folder", updatedAt: T0 + 1 })],
        receiptPages: [pageRow("p", "r", { imagePath: "pages/new.enc", updatedAt: T0 + 1 })],
        lineItems: [lineRow("l", "r", { description: "stale" })],
      }),
    );
    const got = all(db);
    expect(got.folders[0].name).toBe("Snap folder");
    expect(got.receiptPages[0].imagePath).toBe("pages/new.enc");
    expect(got.lineItems[0].description).toBe("keep me");
  });

  it("a soft-deleted snapshot row with newer updatedAt soft-deletes the local row", () => {
    const db = testDb();
    insertLocal(db, { receipts: [receiptRow("r", { merchant: "Gone Soon" })] });
    applyMerge(db, snap({ receipts: [receiptRow("r", { deletedAt: T0 + 3, updatedAt: T0 + 3, version: 2 })] }));
    expect(receiptById(db, "r")?.deletedAt).toBe(T0 + 3);
    expect(searchReceipts(db, "Gone")).toEqual([]);
  });

  it("does not duplicate default categories (same ids)", () => {
    const db = testDb();
    const defaults = all(db).categories;
    expect(defaults.length).toBeGreaterThan(0);
    const res = applyMerge(db, snap({ categories: defaults, receipts: [] }));
    expect(byId(all(db).categories)).toEqual(byId(defaults));
    expect(res.inserted).toBe(0);
  });

  it("handles 450 receipts across the chunk size", () => {
    const db = testDb();
    const rows = Array.from({ length: 450 }, (_, i) => receiptRow(`r-${String(i).padStart(3, "0")}`));
    const res = applyMerge(db, snap({ receipts: rows }));
    expect(res.inserted).toBe(450);
    expect(res.insertedReceiptIds).toHaveLength(450);
    expect(all(db).receipts).toHaveLength(450);
  });
});

describe("applyReplace chunking", () => {
  it("handles 450 receipts and pages", () => {
    const db = testDb();
    const rows = Array.from({ length: 450 }, (_, i) => receiptRow(`r-${i}`));
    const pages = rows.map((r) => pageRow(`p-${r.id}`, r.id));
    applyReplace(db, snap({ receipts: rows, receiptPages: pages }));
    expect(all(db).receipts).toHaveLength(450);
    expect(all(db).receiptPages).toHaveLength(450);
    expect(searchReceipts(db, "r-449").length).toBeGreaterThan(0);
  });
});
