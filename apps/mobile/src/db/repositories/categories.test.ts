import { testDb } from "../testing/testDb";
import { listReceipts } from "./receiptQueries";
import { createReceipt } from "./receipts";
import {
  countReceiptsByCategory,
  createCategory,
  listCategories,
  renameCategory,
  softDeleteCategory,
} from "./categories";
import type { AppDb } from "../types";

function seed(db: AppDb, categoryId: string | null, totalMinor = 1000, status: "confirmed" | "draft" = "confirmed") {
  return createReceipt(db, {
    status,
    merchant: "Shop",
    purchasedAtLocal: "2026-05-10T10:00:00",
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: Date.UTC(2026, 4, 10),
    scannedAtUtc: Date.UTC(2026, 4, 10),
    scannedTz: "Asia/Jakarta",
    currency: "IDR",
    totalMinor,
    taxMinor: null,
    homeCurrencyAtSave: "IDR",
    amountHomeMinor: totalMinor,
    parseSource: "manual",
    categoryId,
  });
}

describe("categories repository", () => {
  it("fresh DB lists exactly the 11 seeded defaults", () => {
    const list = listCategories(testDb());
    expect(list.map((c) => c.id).sort()).toEqual(
      [
        "default:food_drink",
        "default:transport",
        "default:lodging",
        "default:groceries",
        "default:shopping",
        "default:utilities",
        "default:health",
        "default:office",
        "default:entertainment",
        "default:transfer",
        "default:other",
      ].sort(),
    );
    for (const c of list) {
      expect(c.isDefault).toBe(true);
      expect(c.id).toBe(`default:${c.nameKey}`);
      expect(c.version).toBe(1);
    }
  });

  it("orders defaults by sort_order, ending with other", () => {
    const list = listCategories(testDb());
    expect(list[0].id).toBe("default:food_drink");
    expect(list[list.length - 1].id).toBe("default:other");
    expect(list.map((c) => c.sortOrder)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100]);
  });

  describe("management", () => {
    it("createCategory trims, is non-default, sorts after defaults; blank rejected", () => {
      const db = testDb();
      const c = createCategory(db, { name: "  Pets  ", color: "#123456" });
      expect(c.customName).toBe("Pets");
      expect(c.color).toBe("#123456");
      expect(c.isDefault).toBe(false);
      const list = listCategories(db);
      expect(list[list.length - 1].id).toBe(c.id);
      expect(() => createCategory(db, { name: "   ", color: "#123456" })).toThrow();
      expect(listCategories(db)).toHaveLength(12);
    });

    it("renameCategory sets customName, null resets to translated label", () => {
      const db = testDb();
      const r = renameCategory(db, "default:food_drink", "  Eats ");
      expect(r.customName).toBe("Eats");
      const reset = renameCategory(db, "default:food_drink", null);
      expect(reset.customName).toBeNull();
      expect(reset.nameKey).toBe("food_drink");
      expect(() => renameCategory(db, "default:food_drink", "  ")).toThrow();
      expect(() => renameCategory(db, "nope", "X")).toThrow();
    });

    it("softDeleteCategory refuses defaults", () => {
      expect(() => softDeleteCategory(testDb(), "default:other")).toThrow();
      expect(() => softDeleteCategory(testDb(), "default:food_drink")).toThrow();
    });

    it("delete moves receipts to other, keeps them listed, removes category", () => {
      const db = testDb();
      const c = createCategory(db, { name: "Pets", color: "#123456" });
      seed(db, c.id, 1000);
      seed(db, c.id, 2000);
      seed(db, c.id, 3000);
      seed(db, "default:food_drink", 500);
      expect(softDeleteCategory(db, c.id)).toBe(3);
      expect(listCategories(db).some((x) => x.id === c.id)).toBe(false);
      const rows = listReceipts(db, {}, { limit: 50 });
      expect(rows).toHaveLength(4);
      expect(rows.filter((r) => r.categoryId === "default:other")).toHaveLength(3);
      expect(rows.map((r) => r.totalMinor).sort((a, b) => a - b)).toEqual([500, 1000, 2000, 3000]);
    });

    it("countReceiptsByCategory counts confirmed non-deleted only", () => {
      const db = testDb();
      seed(db, "default:transport");
      seed(db, "default:transport");
      seed(db, "default:transport", 1, "draft");
      expect(countReceiptsByCategory(db)).toEqual({ "default:transport": 2 });
    });
  });
});
