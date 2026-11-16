import { and, eq, isNull } from "drizzle-orm";

import { receiptPages, receipts } from "@/db/schema";
import type { AppDb } from "@/db/types";

export type StorageStats = { receipts: number; pages: number; bytes: number };

/**
 * Settings "Storage" row: confirmed, non-deleted receipts, their pages, and the on-disk size of
 * those pages' image + thumb files. `sizeOf` takes the stored relative path; a missing file is 0.
 */
export async function storageStats(db: AppDb, sizeOf: (path: string) => Promise<number>): Promise<StorageStats> {
  const live = and(eq(receipts.status, "confirmed"), isNull(receipts.deletedAt));
  const count = db.select({ id: receipts.id }).from(receipts).where(live).all().length;
  const pages = db
    .select({ imagePath: receiptPages.imagePath, thumbPath: receiptPages.thumbPath })
    .from(receiptPages)
    .innerJoin(receipts, eq(receipts.id, receiptPages.receiptId))
    .where(and(live, isNull(receiptPages.deletedAt)))
    .all();
  const paths = pages.flatMap((p) => (p.thumbPath ? [p.imagePath, p.thumbPath] : [p.imagePath]));
  const sizes = await Promise.all(paths.map((p) => sizeOf(p).catch(() => 0)));
  return { receipts: count, pages: pages.length, bytes: sizes.reduce((a, b) => a + b, 0) };
}

export function formatBytes(n: number, locale: string): string {
  const [unit, div] = n >= 1e9 ? (["gigabyte", 1e9] as const) : n >= 1e6 ? (["megabyte", 1e6] as const) : (["kilobyte", 1e3] as const);
  return new Intl.NumberFormat(locale, { style: "unit", unit, maximumFractionDigits: 1 }).format(n / div);
}
