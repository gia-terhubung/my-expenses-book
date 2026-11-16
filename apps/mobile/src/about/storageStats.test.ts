import { createPage } from "@/db/repositories/pages";
import { createReceipt, softDeleteReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb, NewReceiptInput } from "@/db/types";

import { formatBytes, storageStats } from "./storageStats";

function receipt(db: AppDb, over: Partial<NewReceiptInput> = {}) {
  return createReceipt(db, {
    merchant: "Shop",
    purchasedAtLocal: "2026-03-01T10:00:00",
    purchasedAtUtc: 1772334000000,
    scannedAtUtc: 1772334060000,
    currency: "USD",
    totalMinor: 500,
    parseSource: "manual",
    status: "confirmed",
    ...over,
  });
}

const page = (db: AppDb, receiptId: string, n: number) =>
  createPage(db, { receiptId, pageIndex: n, imagePath: `pages/img-${receiptId}-${n}.enc`, thumbPath: `pages/th-${receiptId}-${n}.enc`, width: 1, height: 1, dhash: null });

describe("storageStats", () => {
  it("counts confirmed live receipts, their pages and file bytes; a missing file is 0", async () => {
    const db = testDb();
    const a = receipt(db);
    const b = receipt(db);
    const draft = receipt(db, { status: "draft" });
    const gone = receipt(db);
    page(db, a.id, 0);
    page(db, a.id, 1);
    page(db, b.id, 0);
    page(db, draft.id, 0);
    page(db, gone.id, 0);
    softDeleteReceipt(db, gone.id);
    const sizes: Record<string, number> = {
      [`pages/img-${a.id}-0.enc`]: 1000,
      [`pages/th-${a.id}-0.enc`]: 100,
      [`pages/img-${a.id}-1.enc`]: 2000,
      [`pages/th-${a.id}-1.enc`]: 200,
      [`pages/img-${b.id}-0.enc`]: 3000,
      // b's thumb is missing on disk
    };
    const sizeOf = async (p: string) => {
      if (!(p in sizes)) throw new Error("missing");
      return sizes[p];
    };
    await expect(storageStats(db, sizeOf)).resolves.toEqual({ receipts: 2, pages: 3, bytes: 6300 });
  });
});

describe("formatBytes", () => {
  it("formats with base 1000 units", () => {
    expect(formatBytes(1_500_000, "en")).toBe("1.5 MB");
    expect(formatBytes(0, "en")).toBe("0 kB");
    expect(formatBytes(2_300_000_000, "en")).toBe("2.3 GB");
  });
});
