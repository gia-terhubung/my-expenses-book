import { getTableColumns } from "drizzle-orm";

import { createReceipt, softDeleteReceipt } from "@/db/repositories/receipts";
import * as schema from "@/db/schema";
import { testDb } from "@/db/testing/testDb";
import { createPrefs, type KV } from "@/prefs/prefs";

import {
  SCHEMA_VERSION,
  categoryShape,
  collectSnapshot,
  folderShape,
  lineItemShape,
  receiptPageShape,
  receiptShape,
  snapshotSchema,
} from "./snapshot";

function prefs() {
  const m = new Map<string, string>();
  const kv: KV = { getString: (k) => m.get(k), set: (k, v) => void m.set(k, v), delete: (k) => void m.delete(k) };
  return createPrefs(kv);
}

const seed = (db: ReturnType<typeof testDb>) =>
  createReceipt(db, {
    merchant: "Toko",
    purchasedAtLocal: "2026-03-01T10:00:00",
    purchasedAtUtc: 1772334000000,
    scannedAtUtc: 1772334060000,
    currency: "IDR",
    totalMinor: 12500,
    parseSource: "manual",
    status: "confirmed",
  });

describe("collectSnapshot", () => {
  it("includes soft-deleted receipts, default categories, and parses", () => {
    const db = testDb();
    const r = seed(db);
    softDeleteReceipt(db, r.id);
    const snap = collectSnapshot(db, prefs());
    const row = snap.receipts.find((x) => x.id === r.id);
    expect(row?.deletedAt).not.toBeNull();
    expect(snap.categories.length).toBeGreaterThan(0);
    expect(snap.schemaVersion).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(4);
    expect(snapshotSchema.parse(JSON.parse(JSON.stringify(snap)))).toEqual(snap);
  });

  it("zod keys match table columns", () => {
    const pairs: [object, object][] = [
      [categoryShape.shape, schema.categories],
      [folderShape.shape, schema.folders],
      [receiptShape.shape, schema.receipts],
      [receiptPageShape.shape, schema.receiptPages],
      [lineItemShape.shape, schema.lineItems],
    ];
    for (const [shape, table] of pairs) {
      expect(Object.keys(shape).sort()).toEqual(Object.keys(getTableColumns(table as never)).sort());
    }
  });

  it("rejects a receipt missing currency", () => {
    const db = testDb();
    seed(db);
    const snap = JSON.parse(JSON.stringify(collectSnapshot(db, prefs())));
    delete snap.receipts[0].currency;
    expect(snapshotSchema.safeParse(snap).success).toBe(false);
  });
});
