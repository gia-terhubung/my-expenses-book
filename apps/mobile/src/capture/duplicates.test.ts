import { createPage } from "@/db/repositories/pages";
import { createReceipt, softDeleteReceipt, updateReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb, NewReceiptInput, Receipt } from "@/db/types";

import { findDuplicates } from "./duplicates";

const BASE_UTC = Date.UTC(2026, 10, 5, 3, 0, 0);

function input(over: Partial<NewReceiptInput> = {}): NewReceiptInput {
  return {
    merchant: "Toko Maju Jaya",
    purchasedAtLocal: "2026-11-05T10:00:00",
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: BASE_UTC,
    scannedAtUtc: BASE_UTC,
    scannedTz: "Asia/Jakarta",
    currency: "IDR",
    totalMinor: 2_500_000,
    parseSource: "heuristic",
    status: "confirmed",
    ...over,
  };
}

/** Receipt on `date` (YYYY-MM-DD), 10:00 Jakarta. */
function onDate(date: string): Partial<NewReceiptInput> {
  const [y, m, d] = date.split("-").map(Number);
  return { purchasedAtLocal: `${date}T10:00:00`, purchasedAtUtc: Date.UTC(y, m - 1, d, 3, 0, 0) };
}

function withPage(db: AppDb, r: Receipt, dhash: string, imagePath = `pages/${r.id}.enc`): Receipt {
  createPage(db, { receiptId: r.id, pageIndex: 0, imagePath, thumbPath: null, width: 1, height: 1, dhash });
  return r;
}

function draft(db: AppDb, over: Partial<NewReceiptInput> = {}): Receipt {
  return createReceipt(db, input({ status: "draft", ...over }));
}

describe("findDuplicates", () => {
  it("orders exact-ref before similar and lists each receipt once", () => {
    const db = testDb();
    const similar = createReceipt(db, input({ refNo: null }));
    const exact = createReceipt(db, input({ refNo: "INV-001", merchant: "Something Else", totalMinor: 9 }));
    const both = createReceipt(db, input({ refNo: "INV-001" }));
    const me = draft(db, { refNo: "INV-001" });
    const out = findDuplicates(db, me, []);
    expect(out[0].strength).toBe("exact-ref");
    expect(out.filter((m) => m.strength === "exact-ref").map((m) => m.receiptId).sort()).toEqual(
      [exact.id, both.id].sort(),
    );
    expect(out.find((m) => m.receiptId === similar.id)?.strength).toBe("similar");
    expect(out.filter((m) => m.receiptId === both.id)).toHaveLength(1);
    expect(out.map((m) => m.strength)).toEqual(["exact-ref", "exact-ref", "similar"]);
  });

  it("matches page dHash at distance 6, not 7", () => {
    const db = testDb();
    const near = withPage(db, createReceipt(db, input({ totalMinor: 1, merchant: "A" })), "000000000000003f"); // 6 bits
    const far = withPage(db, createReceipt(db, input({ totalMinor: 2, merchant: "B" })), "000000000000007f"); // 7 bits
    const me = draft(db, { totalMinor: 3, merchant: "C" });
    const out = findDuplicates(db, me, ["0000000000000000"]);
    expect(out).toEqual([{ receiptId: near.id, strength: "same-image" }]);
    expect(out.some((m) => m.receiptId === far.id)).toBe(false);
  });

  it("uses a ±1 day purchase-date window", () => {
    const db = testDb();
    const dayBefore = createReceipt(db, input(onDate("2026-11-04")));
    const dayAfter = createReceipt(db, input(onDate("2026-11-06")));
    createReceipt(db, input(onDate("2026-11-03")));
    createReceipt(db, input(onDate("2026-11-07")));
    createReceipt(db, input({ ...onDate("2026-11-05"), currency: "USD" }));
    createReceipt(db, input({ ...onDate("2026-11-05"), totalMinor: 2_500_001 }));
    createReceipt(db, input({ ...onDate("2026-11-05"), merchant: "Warung Sederhana" }));
    const me = draft(db, onDate("2026-11-05"));
    const out = findDuplicates(db, me, []);
    expect(out.map((m) => m.receiptId).sort()).toEqual([dayBefore.id, dayAfter.id].sort());
    expect(out.every((m) => m.strength === "similar")).toBe(true);
  });

  it("ignores drafts, soft-deleted receipts and itself", () => {
    const db = testDb();
    withPage(db, draft(db, { refNo: "INV-9" }), "0000000000000000");
    const gone = withPage(db, createReceipt(db, input({ refNo: "INV-9" })), "0000000000000000");
    softDeleteReceipt(db, gone.id);
    const me = withPage(db, draft(db, { refNo: "INV-9" }), "0000000000000000");
    expect(findDuplicates(db, me, ["0000000000000000"])).toEqual([]);
  });

  it("matches on amount and date when either merchant is null", () => {
    const db = testDb();
    const noName = createReceipt(db, input({ merchant: null }));
    const named = createReceipt(db, input({ merchant: "Completely Different" }));
    const me = draft(db, { merchant: null });
    const out = findDuplicates(db, me, []);
    expect(out.map((m) => m.receiptId).sort()).toEqual([noName.id, named.id].sort());
    const me2 = draft(db, { merchant: "TOKO MAJU" });
    // "toko maju" vs "toko maju jaya": Jaccard 2/3 >= 0.5; null merchant skips the test.
    expect(findDuplicates(db, me2, []).map((m) => m.receiptId)).toEqual([noName.id]);
  });

  it("does not flag split siblings that share the same page file as same-image", () => {
    const db = testDb();
    const shared = "pages/shared.enc";
    const sib1 = withPage(db, draft(db, { totalMinor: 1, merchant: "A" }), "0000000000000000", shared);
    const sib2 = withPage(db, draft(db, { totalMinor: 2, merchant: "B" }), "0000000000000000", shared);
    updateReceipt(db, sib1.id, { status: "confirmed" });
    const other = withPage(db, createReceipt(db, input({ totalMinor: 3, merchant: "C" })), "0000000000000001");
    expect(findDuplicates(db, sib2, ["0000000000000000"])).toEqual([{ receiptId: other.id, strength: "same-image" }]);
  });

  it("skips the similar pass for a zero or unknown total", () => {
    const db = testDb();
    createReceipt(db, input({ totalMinor: 0, merchant: null }));
    const free = createReceipt(db, input({ merchant: null }));
    expect(findDuplicates(db, draft(db, { totalMinor: 0, merchant: null, parseSource: "manual" }), [])).toEqual([]);
    const unsure = draft(db, { merchant: null, parseConfidence: JSON.stringify({ total: 0 }) });
    expect(findDuplicates(db, unsure, [])).toEqual([]);
    const sure = draft(db, { merchant: null, parseConfidence: JSON.stringify({ total: 0.9 }) });
    expect(findDuplicates(db, sure, []).map((m) => m.receiptId)).toEqual([free.id]);
  });
});
