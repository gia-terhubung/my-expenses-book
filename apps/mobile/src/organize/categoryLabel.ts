import type { Category } from "@/db/types";

/** The one display label for a category: list, review, search, CSV and PDF all use this. */
export function categoryLabel(c: Category, t: (k: string) => string): string {
  return c.customName ?? (c.nameKey ? t(`categories.${c.nameKey}`) : "—");
}
