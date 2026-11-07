import { eq, sql } from "drizzle-orm";

import { categories, folders, lineItems, receiptPages, receipts } from "@/db/schema";
import type { AppDb } from "@/db/types";

import type { Snapshot } from "./snapshot";

export type RestoreMode = "replace" | "merge";

/**
 * Counts are for receipts only (the user-facing numbers); categories, folders, pages and line
 * items follow the same rule but are not counted. `updated`: the snapshot row won over an existing
 * row; `kept`: the local row won.
 */
export type MergeResult = { inserted: number; updated: number; kept: number; insertedReceiptIds: string[] };

/** SQLite caps bound variables per statement; 200 rows x ~30 columns stays well under it. */
const CHUNK = 200;

type Tx = Parameters<Parameters<AppDb["transaction"]>[0]>[0];
type SyncRow = { id: string; updatedAt: number; version: number };

// Parent tables first, so ids referenced by later tables already exist.
const TABLES = [
  ["categories", categories],
  ["folders", folders],
  ["receipts", receipts],
  ["receiptPages", receiptPages],
  ["lineItems", lineItems],
] as const;

type TableKey = (typeof TABLES)[number][0];
type AnyTable = (typeof TABLES)[number][1];

function insertChunked(tx: Tx, table: AnyTable, rows: SyncRow[]): void {
  for (let i = 0; i < rows.length; i += CHUNK) {
    // Rows come from the zod-validated snapshot of this exact table.
    tx.insert(table).values(rows.slice(i, i + CHUNK) as never).run();
  }
}

/** External-content FTS: re-derive the index from `receipts` (see the FTS warning in schema.ts). */
function rebuildFts(tx: Tx): void {
  tx.run(sql`INSERT INTO receipts_fts(receipts_fts) VALUES('rebuild')`);
}

const rowsOf = (s: Snapshot, key: TableKey) => s[key] as SyncRow[];

/**
 * Replaces every row of the five tables (default categories included) with the snapshot, in one
 * transaction. This is the only place rows are hard-deleted; any throw rolls everything back.
 */
export function applyReplace(db: AppDb, s: Snapshot): void {
  db.transaction((tx) => {
    for (const [, table] of TABLES) tx.delete(table).run();
    for (const [key, table] of TABLES) insertChunked(tx, table, rowsOf(s, key));
    rebuildFts(tx);
  });
}

/** C4: snapshot row wins on larger updatedAt; tie on larger version; still tied, local stays. */
function snapshotWins(snap: SyncRow, local: SyncRow): boolean {
  if (snap.updatedAt !== local.updatedAt) return snap.updatedAt > local.updatedAt;
  return snap.version > local.version;
}

/**
 * Merges the snapshot by id in one transaction: absent locally -> insert; present -> rule C4.
 * A winning soft-deleted snapshot row soft-deletes the local row (deletedAt is just a column).
 */
export function applyMerge(db: AppDb, s: Snapshot): MergeResult {
  const result: MergeResult = { inserted: 0, updated: 0, kept: 0, insertedReceiptIds: [] };
  db.transaction((tx) => {
    for (const [key, table] of TABLES) {
      const local = new Map<string, SyncRow>();
      for (const r of tx
        .select({ id: table.id, updatedAt: table.updatedAt, version: table.version })
        .from(table)
        .all()) {
        local.set(r.id, r);
      }
      const toInsert: SyncRow[] = [];
      let updated = 0;
      let kept = 0;
      for (const row of rowsOf(s, key)) {
        const existing = local.get(row.id);
        if (!existing) {
          toInsert.push(row);
        } else if (snapshotWins(row, existing)) {
          tx.update(table)
            .set(row as never)
            .where(eq(table.id, row.id))
            .run();
          updated++;
        } else {
          kept++;
        }
      }
      insertChunked(tx, table, toInsert);
      if (key === "receipts") {
        result.inserted = toInsert.length;
        result.updated = updated;
        result.kept = kept;
        result.insertedReceiptIds = toInsert.map((r) => r.id);
      }
    }
    rebuildFts(tx);
  });
  return result;
}
