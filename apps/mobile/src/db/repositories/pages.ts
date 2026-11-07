import { and, asc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";

import { newId, now } from "../ids";
import { receiptPages } from "../schema";
import type { AppDb, ReceiptPage } from "../types";

export type NewPageInput = {
  receiptId: string;
  pageIndex: number;
  imagePath: string;
  thumbPath: string | null;
  width: number;
  height: number;
  dhash: string | null;
};

export function createPage(db: AppDb, input: NewPageInput): ReceiptPage {
  const t = now();
  return db
    .insert(receiptPages)
    .values({ ...input, id: newId(), createdAt: t, updatedAt: t })
    .returning()
    .get();
}

export function listPages(db: AppDb, receiptId: string): ReceiptPage[] {
  return db
    .select()
    .from(receiptPages)
    .where(and(eq(receiptPages.receiptId, receiptId), isNull(receiptPages.deletedAt)))
    .orderBy(asc(receiptPages.pageIndex))
    .all();
}

/** Image + thumb paths of every non-deleted page (orphan-file cleanup). */
export function listAllPagePaths(db: AppDb): string[] {
  const rows = db
    .select({ imagePath: receiptPages.imagePath, thumbPath: receiptPages.thumbPath })
    .from(receiptPages)
    .where(isNull(receiptPages.deletedAt))
    .all();
  return rows.flatMap((r) => (r.thumbPath ? [r.imagePath, r.thumbPath] : [r.imagePath]));
}

/** All non-deleted pages with a dhash; Hamming filtering happens in JS. */
export function listPageHashes(db: AppDb): { receiptId: string; dhash: string; imagePath: string }[] {
  const rows = db
    .select({ receiptId: receiptPages.receiptId, dhash: receiptPages.dhash, imagePath: receiptPages.imagePath })
    .from(receiptPages)
    .where(and(isNull(receiptPages.deletedAt), isNotNull(receiptPages.dhash)))
    .all();
  return rows.map((r) => ({ receiptId: r.receiptId, dhash: r.dhash as string, imagePath: r.imagePath }));
}

/** Live pages of receipts other than `excludeReceiptId` that use `imagePath` (split siblings share files). */
export function countPagesByImagePath(db: AppDb, imagePath: string, excludeReceiptId: string): number {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(receiptPages)
    .where(
      and(
        isNull(receiptPages.deletedAt),
        eq(receiptPages.imagePath, imagePath),
        ne(receiptPages.receiptId, excludeReceiptId),
      ),
    )
    .get();
  return row?.n ?? 0;
}

/** Soft-deletes every page row of a receipt (discarded draft). */
export function softDeletePages(db: AppDb, receiptId: string): void {
  const t = now();
  db.update(receiptPages)
    .set({ deletedAt: t, updatedAt: t, version: sql`${receiptPages.version} + 1` })
    .where(and(eq(receiptPages.receiptId, receiptId), isNull(receiptPages.deletedAt)))
    .run();
}
