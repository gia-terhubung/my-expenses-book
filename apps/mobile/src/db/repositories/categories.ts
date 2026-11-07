import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { notifyDataChanged } from "../changes";
import { newId, now } from "../ids";
import { categories, receipts } from "../schema";
import type { AppDb, Category } from "../types";

/** Non-deleted categories, defaults first. */
export function listCategories(db: AppDb): Category[] {
  return db
    .select()
    .from(categories)
    .where(isNull(categories.deletedAt))
    .orderBy(desc(categories.isDefault), asc(categories.sortOrder), asc(categories.nameKey), asc(categories.customName), asc(categories.id))
    .all();
}

const FALLBACK_ID = "default:other";

/** Adds a custom category after every existing one. Rejects a blank name. */
export function createCategory(db: AppDb, input: { name: string; color: string }): Category {
  const name = input.name.trim();
  if (!name) throw new Error("Category name is required");
  const t = now();
  const row = db
    .insert(categories)
    .values({
      id: newId(),
      customName: name,
      color: input.color,
      isDefault: false,
      sortOrder: sql`(SELECT COALESCE(MAX(${categories.sortOrder}), 0) + 1 FROM ${categories})`,
      createdAt: t,
      updatedAt: t,
    })
    .returning()
    .get();
  notifyDataChanged();
  return row;
}

/** Sets the display name; null clears it so a default shows its translated label again. */
export function renameCategory(db: AppDb, id: string, name: string | null): Category {
  const trimmed = name === null ? null : name.trim();
  if (trimmed === "") throw new Error("Category name is required");
  const row = db
    .update(categories)
    .set({ customName: trimmed, updatedAt: now(), version: sql`${categories.version} + 1` })
    .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
    .returning()
    .get();
  if (!row) throw new Error(`Category not found: ${id}`);
  notifyDataChanged();
  return row;
}

/** Soft-deletes a custom category and moves its receipts to "Other". Returns the moved count. */
export function softDeleteCategory(db: AppDb, id: string): number {
  const t = now();
  const moved = db.transaction((tx) => {
    const cat = tx
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), isNull(categories.deletedAt)))
      .get();
    if (!cat) throw new Error(`Category not found: ${id}`);
    if (cat.isDefault) throw new Error("Default categories cannot be deleted");
    const res = tx
      .update(receipts)
      .set({ categoryId: FALLBACK_ID, updatedAt: t, version: sql`${receipts.version} + 1` })
      .where(and(eq(receipts.categoryId, id), isNull(receipts.deletedAt)))
      .run();
    tx.update(categories)
      .set({ deletedAt: t, updatedAt: t, version: sql`${categories.version} + 1` })
      .where(eq(categories.id, id))
      .run();
    return res.changes;
  });
  notifyDataChanged();
  return moved;
}

/** Confirmed, non-deleted receipt count per category id (categories with none are absent). */
export function countReceiptsByCategory(db: AppDb): Record<string, number> {
  const rows = db
    .select({ id: receipts.categoryId, n: sql<number>`count(*)` })
    .from(receipts)
    .where(and(eq(receipts.status, "confirmed"), isNull(receipts.deletedAt)))
    .groupBy(receipts.categoryId)
    .all();
  const out: Record<string, number> = {};
  for (const r of rows) if (r.id) out[r.id] = r.n;
  return out;
}
