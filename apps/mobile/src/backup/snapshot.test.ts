import { getTableColumns } from "drizzle-orm";

import { listAllPagePaths } from "@/db/repositories/pages";
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
import { applyReplace } from "./applySnapshot";
import fixtureV4 from "./fixtures/snapshot-v4.json";

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

/**
 * Frozen archive snapshot written by schema 4 (synthetic data). Never regenerate it: it stands
 * for backups already on users' devices. When a migration adds a column, add the field to the
 * shape as .optional() so this keeps parsing (see docs/m4-followups.md).
 */
describe("forward compatibility: schema 4 snapshot fixture", () => {
  it("parses with the current snapshotSchema and restores into a fresh DB", () => {
    expect(fixtureV4.schemaVersion).toBe(4);
    const snap = snapshotSchema.parse(fixtureV4);
    const db = testDb();
    applyReplace(db, snap);
    const back = collectSnapshot(db, prefs());
    expect(back.receipts.map((r) => r.merchant).sort()).toEqual(["Deleted Shop", "Sample Store"]);
    expect(back.receipts.find((r) => r.merchant === "Deleted Shop")?.deletedAt).not.toBeNull();
    expect(back.folders.map((f) => f.name)).toEqual(["Sample trip"]);
    expect(back.lineItems.map((l) => l.description)).toEqual(["Item A"]);
    expect(listAllPagePaths(db).sort()).toEqual(["pages/fixture-img.enc", "pages/fixture-thumb.enc"]);
    expect(back.categories).toHaveLength(snap.categories.length);
  });
});
