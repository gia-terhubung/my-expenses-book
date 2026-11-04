import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { newId, now } from "../ids";
import { receipts } from "../schema";
import type { AppDb, NewReceiptInput, Receipt } from "../types";

export function createReceipt(db: AppDb, input: NewReceiptInput): Receipt {
  const t = now();
  return db
    .insert(receipts)
    .values({ ...input, status: input.status ?? "draft", id: newId(), createdAt: t, updatedAt: t })
    .returning()
    .get();
}

export function getReceipt(db: AppDb, id: string): Receipt | null {
  return (
    db
      .select()
      .from(receipts)
      .where(and(eq(receipts.id, id), isNull(receipts.deletedAt)))
      .get() ?? null
  );
}

export function updateReceipt(db: AppDb, id: string, patch: Partial<NewReceiptInput>): Receipt {
  const row = db
    .update(receipts)
    .set({ ...patch, updatedAt: now(), version: sql`${receipts.version} + 1` })
    .where(and(eq(receipts.id, id), isNull(receipts.deletedAt)))
    .returning()
    .get();
  if (!row) throw new Error(`Receipt not found: ${id}`);
  return row;
}

export function softDeleteReceipt(db: AppDb, id: string): void {
  const t = now();
  db.update(receipts)
    .set({ deletedAt: t, updatedAt: t, version: sql`${receipts.version} + 1` })
    .where(and(eq(receipts.id, id), isNull(receipts.deletedAt)))
    .run();
}

/**
 * Turns free text into a safe FTS5 query: every whitespace-separated token is
 * double-quoted (so operators/punctuation are literals) and gets a `*` suffix
 * for prefix matching. Returns null when nothing searchable remains.
 */
function toFtsQuery(query: string): string | null {
  const tokens = query
    .split(/\s+/)
    .map((t) => t.replace(/"/g, ""))
    .filter((t) => /[\p{L}\p{N}]/u.test(t));
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(" ");
}

export function searchReceipts(db: AppDb, query: string): Receipt[] {
  const match = toFtsQuery(query);
  if (!match) return [];
  return db
    .select()
    .from(receipts)
    .where(
      and(
        isNull(receipts.deletedAt),
        sql`receipts.rowid IN (SELECT rowid FROM receipts_fts WHERE receipts_fts MATCH ${match})`,
      ),
    )
    .orderBy(desc(receipts.purchasedAtUtc), desc(receipts.id))
    .all();
}
