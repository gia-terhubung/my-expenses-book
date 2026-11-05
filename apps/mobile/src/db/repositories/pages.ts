import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";

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
export function listPageHashes(db: AppDb): { receiptId: string; dhash: string }[] {
  const rows = db
    .select({ receiptId: receiptPages.receiptId, dhash: receiptPages.dhash })
    .from(receiptPages)
    .where(and(isNull(receiptPages.deletedAt), isNotNull(receiptPages.dhash)))
    .all();
  return rows.map((r) => ({ receiptId: r.receiptId, dhash: r.dhash as string }));
}
