import { asc, desc, isNull } from "drizzle-orm";

import { categories } from "../schema";
import type { AppDb, Category } from "../types";

/** Non-deleted categories, defaults first. */
export function listCategories(db: AppDb): Category[] {
  return db
    .select()
    .from(categories)
    .where(isNull(categories.deletedAt))
    .orderBy(desc(categories.isDefault), asc(categories.sortOrder), asc(categories.nameKey), asc(categories.customName), asc(categories.id))
    .all();
}
