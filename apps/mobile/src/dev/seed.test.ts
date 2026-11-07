import { listPurchaseMonths, listReceipts, type ReceiptCursor } from "@/db/repositories/receiptQueries";
import { testDb } from "@/db/testing/testDb";
import type { Receipt } from "@/db/types";

import { seedSyntheticReceipts } from "./seed";

const opts = { home: "IDR", seed: 42, today: "2026-11-07" };

describe("seedSyntheticReceipts", () => {
  it("seeds 500 receipts spanning 12+ months, some unconverted, pages in under 2 s", () => {
    const db = testDb();
    expect(seedSyntheticReceipts(db, 500, opts)).toBe(500);
    expect(listPurchaseMonths(db).length).toBeGreaterThanOrEqual(12);

    const started = Date.now();
    const all: Receipt[] = [];
    let after: ReceiptCursor | undefined;
    for (;;) {
      const page = listReceipts(db, {}, { limit: 50, after });
      all.push(...page);
      if (page.length < 50) break;
      const last = page[page.length - 1]!;
      after = { purchasedAtLocal: last.purchasedAtLocal, id: last.id };
    }
    expect(Date.now() - started).toBeLessThan(2000);
    expect(all).toHaveLength(500);
    expect(all.some((r) => r.amountHomeMinor === null)).toBe(true);
    expect(new Set(all.map((r) => r.currency))).toEqual(new Set(["IDR", "USD", "EUR", "JPY"]));
    expect(new Set(all.map((r) => r.categoryId)).size).toBe(11);
    expect(new Set(all.map((r) => r.folderId).filter(Boolean)).size).toBe(3);
  });

  it("is deterministic apart from ids", () => {
    const strip = (db: ReturnType<typeof testDb>) =>
      listReceipts(db, {}, { limit: 100 }).map((r) => [r.merchant, r.purchasedAtLocal, r.currency, r.totalMinor, r.amountHomeMinor]);
    const a = testDb();
    const b = testDb();
    seedSyntheticReceipts(a, 100, opts);
    seedSyntheticReceipts(b, 100, opts);
    expect(strip(a).sort()).toEqual(strip(b).sort());
  });
});
