import { testDb } from "../testing/testDb";
import { listCategories } from "./categories";

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
});
