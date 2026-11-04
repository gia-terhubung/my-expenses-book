import { testDb } from "../testing/testDb";
import { listCategories } from "./categories";

describe("categories repository", () => {
  it("fresh DB lists exactly the 10 seeded defaults", () => {
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
        "default:other",
      ].sort(),
    );
    for (const c of list) {
      expect(c.isDefault).toBe(true);
      expect(c.id).toBe(`default:${c.nameKey}`);
      expect(c.version).toBe(1);
    }
  });
});
