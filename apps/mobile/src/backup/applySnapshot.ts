import { eq, sql } from "drizzle-orm";

import { categories, folders, lineItems, receiptPages, receipts, recurringRules } from "@/db/schema";
import type { AppDb } from "@/db/types";

import type { Snapshot } from "./snapshot";

export type RestoreMode = "replace" | "merge";

/**
 * Counts are for receipts only (the user-facing numbers); categories, folders, recurring rules,
 * pages and line items follow the same rule but are not counted. `updated`: the snapshot row won
 * over an existing row; `kept`: the local row won, or the snapshot receipt was skipped because
 * another live local receipt already holds its recurring occurrence.
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
  ["recurringRules", recurringRules],
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
 * Replaces every row of the six tables (default categories included) with the snapshot, in one
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

type Occurrence = { id: string; recurringRuleId: string | null; recurringDate: string | null; deletedAt: number | null };

/** The (rule, date) pair a live occurrence holds; null for plain or soft-deleted receipts. */
function occurrenceKey(r: Occurrence): string | null {
  if (r.deletedAt !== null || r.recurringRuleId === null || r.recurringDate === null) return null;
  return `${r.recurringRuleId}\u0000${r.recurringDate}`;
}

/**
 * Tracks which receipt holds each live recurring occurrence, mirroring the partial unique index
 * receipts_recurring_occurrence_uq, so the merge never writes a row that would violate it (that
 * would throw and roll back the whole restore). Seeded with the local rows; every admitted
 * snapshot row moves its claim.
 */
function occurrenceGuard(tx: Tx): (row: Occurrence) => boolean {
  const holderOf = new Map<string, string>(); // key -> receipt id
  const keyOf = new Map<string, string>(); // receipt id -> key
  const hold = (id: string, key: string) => {
    holderOf.set(key, id);
    keyOf.set(id, key);
  };
  for (const r of tx
    .select({
      id: receipts.id,
      recurringRuleId: receipts.recurringRuleId,
      recurringDate: receipts.recurringDate,
      deletedAt: receipts.deletedAt,
    })
    .from(receipts)
    .all()) {
    const key = occurrenceKey(r);
    if (key !== null) hold(r.id, key);
  }
  /** False when another live receipt holds `row`'s occurrence; otherwise records `row` as holder. */
  return (row) => {
    const key = occurrenceKey(row);
    if (key !== null) {
      const holder = holderOf.get(key);
      if (holder !== undefined && holder !== row.id) return false;
    }
    const previous = keyOf.get(row.id);
    if (previous !== undefined) {
      holderOf.delete(previous);
      keyOf.delete(row.id);
    }
    if (key !== null) hold(row.id, key);
    return true;
  };
}

/** YYYY-MM-DD strings compare as dates; null (never generated) is earlier than any date. */
function laterDate(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a >= b ? a : b;
}

/**
 * Merges the snapshot by id in one transaction: absent locally -> insert; present -> rule C4.
 * A winning soft-deleted snapshot row soft-deletes the local row (deletedAt is just a column).
 *
 * Recurring additions:
 * - A snapshot receipt whose live (recurringRuleId, recurringDate) is already held by another
 *   live local receipt is skipped and counted as kept, with its pages and line items; a winning
 *   update that would move a row onto such a pair is skipped the same way. No duplicate expense.
 * - A rule's lastGeneratedDate becomes the later of both sides, whichever row won C4, so catch-up
 *   never re-creates occurrences either side already generated.
 */
export function applyMerge(db: AppDb, s: Snapshot): MergeResult {
  const result: MergeResult = { inserted: 0, updated: 0, kept: 0, insertedReceiptIds: [] };
  db.transaction((tx) => {
    const skippedReceiptIds = new Set<string>();
    const localLastGenerated = new Map(
      tx
        .select({ id: recurringRules.id, lastGeneratedDate: recurringRules.lastGeneratedDate })
        .from(recurringRules)
        .all()
        .map((r) => [r.id, r.lastGeneratedDate] as const),
    );
    for (const [key, table] of TABLES) {
      const local = new Map<string, SyncRow>();
      for (const r of tx
        .select({ id: table.id, updatedAt: table.updatedAt, version: table.version })
        .from(table)
        .all()) {
        local.set(r.id, r);
      }
      const admit = key === "receipts" ? occurrenceGuard(tx) : () => true;
      let rows = rowsOf(s, key);
      if (key === "receiptPages" || key === "lineItems") {
        rows = rows.filter((r) => !skippedReceiptIds.has((r as SyncRow & { receiptId: string }).receiptId));
      }
      const toInsert: SyncRow[] = [];
      let updated = 0;
      let kept = 0;
      for (const row of rows) {
        const existing = local.get(row.id);
        if (!existing) {
          if (admit(row as never)) {
            toInsert.push(row);
          } else {
            skippedReceiptIds.add(row.id);
            kept++;
          }
        } else if (snapshotWins(row, existing) && admit(row as never)) {
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
      if (key === "recurringRules") {
        for (const rule of s.recurringRules) {
          if (!localLastGenerated.has(rule.id)) continue;
          const later = laterDate(localLastGenerated.get(rule.id) ?? null, rule.lastGeneratedDate);
          tx.update(recurringRules)
            .set({ lastGeneratedDate: later })
            .where(eq(recurringRules.id, rule.id))
            .run();
        }
      }
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
