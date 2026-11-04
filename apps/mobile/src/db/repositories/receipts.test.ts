import type { NewReceiptInput } from "../types";
import { testDb } from "../testing/testDb";
import {
  createReceipt,
  getReceipt,
  searchReceipts,
  softDeleteReceipt,
  updateReceipt,
} from "./receipts";

function input(over: Partial<NewReceiptInput> = {}): NewReceiptInput {
  return {
    merchant: "Indomaret",
    purchasedAtLocal: "2026-03-01T10:00:00",
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: 1772334000000,
    scannedAtUtc: 1772334060000,
    scannedTz: "Asia/Jakarta",
    currency: "IDR",
    totalMinor: 50000,
    parseSource: "heuristic",
    ...over,
  };
}

describe("receipts repository", () => {
  it("create then get returns same fields, version 1, draft", () => {
    const db = testDb();
    const created = createReceipt(db, input({ notes: "snacks" }));
    expect(created.version).toBe(1);
    expect(created.status).toBe("draft");
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(getReceipt(db, created.id)).toEqual(created);
    expect(created).toMatchObject({ merchant: "Indomaret", totalMinor: 50000, notes: "snacks" });
  });

  it("update bumps version and updated_at", () => {
    const db = testDb();
    jest.useFakeTimers({ now: 1_000 });
    const r = createReceipt(db, input());
    jest.setSystemTime(2_000);
    const u = updateReceipt(db, r.id, { totalMinor: 70000 });
    jest.useRealTimers();
    expect(u.version).toBe(2);
    expect(u.updatedAt).toBeGreaterThan(r.updatedAt);
    expect(u.totalMinor).toBe(70000);
    expect(u.createdAt).toBe(r.createdAt);
  });

  it("soft delete hides receipt from get", () => {
    const db = testDb();
    const r = createReceipt(db, input());
    softDeleteReceipt(db, r.id);
    expect(getReceipt(db, r.id)).toBeNull();
  });

  it("update of missing receipt throws", () => {
    expect(() => updateReceipt(testDb(), "nope", { notes: "x" })).toThrow();
  });

  describe("search", () => {
    it("prefix-matches merchant", () => {
      const db = testDb();
      const r = createReceipt(db, input());
      expect(searchReceipts(db, "indom").map((x) => x.id)).toEqual([r.id]);
    });

    it("finds text only in raw_ocr_text", () => {
      const db = testDb();
      const r = createReceipt(db, input({ rawOcrText: "TOTAL nasi goreng spesial" }));
      expect(searchReceipts(db, "goreng").map((x) => x.id)).toEqual([r.id]);
    });

    it("matches diacritics-insensitively", () => {
      const db = testDb();
      const r = createReceipt(db, input({ merchant: "Café Kopi" }));
      expect(searchReceipts(db, "cafe").map((x) => x.id)).toEqual([r.id]);
    });

    it("excludes soft-deleted receipts", () => {
      const db = testDb();
      const r = createReceipt(db, input());
      softDeleteReceipt(db, r.id);
      expect(searchReceipts(db, "indomaret")).toEqual([]);
    });

    it("old merchant no longer matches after update; new one does", () => {
      const db = testDb();
      const r = createReceipt(db, input());
      updateReceipt(db, r.id, { merchant: "Alfamart" });
      expect(searchReceipts(db, "indomaret")).toEqual([]);
      expect(searchReceipts(db, "alfa").map((x) => x.id)).toEqual([r.id]);
    });

    it("orders by purchased_at_utc desc", () => {
      const db = testDb();
      const a = createReceipt(db, input({ purchasedAtUtc: 1000 }));
      const b = createReceipt(db, input({ purchasedAtUtc: 3000 }));
      const c = createReceipt(db, input({ purchasedAtUtc: 2000 }));
      expect(searchReceipts(db, "indomaret").map((x) => x.id)).toEqual([b.id, c.id, a.id]);
    });

    it.each(['"', "-", "AND", "(", "foo OR", "*", "a:b", "NEAR(", '"unterminated', "'", ""])(
      "hostile query %j never throws",
      (q) => {
        const db = testDb();
        createReceipt(db, input({ notes: "and or near" }));
        expect(() => searchReceipts(db, q)).not.toThrow();
      },
    );

    it("treats operator words as plain tokens", () => {
      const db = testDb();
      const r = createReceipt(db, input({ notes: "salt and pepper" }));
      expect(searchReceipts(db, "AND").map((x) => x.id)).toEqual([r.id]);
    });
  });
});
