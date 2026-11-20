import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export type ParseSource = "apple_fm" | "gemini_nano" | "heuristic" | "manual";
export type ReceiptStatus = "draft" | "confirmed";
export type FolderKind = "project" | "trip";
export type RecurringFrequency = "weekly" | "monthly" | "yearly";

/** Sync-ready columns shared by every table. */
const base = {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
  version: integer("version").notNull().default(1),
};

export const categories = sqliteTable("categories", {
  ...base,
  nameKey: text("name_key"),
  customName: text("custom_name"),
  icon: text("icon"),
  color: text("color"),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const folders = sqliteTable("folders", {
  ...base,
  name: text("name").notNull(),
  kind: text("kind").$type<FolderKind>().notNull(),
  defaultCurrency: text("default_currency"),
});

export const recurringRules = sqliteTable("recurring_rules", {
  ...base,
  merchant: text("merchant"),
  currency: text("currency").notNull(),
  totalMinor: integer("total_minor").notNull(),
  taxMinor: integer("tax_minor"),
  categoryId: text("category_id"),
  folderId: text("folder_id"),
  notes: text("notes"),
  frequency: text("frequency").$type<RecurringFrequency>().notNull(),
  anchorDate: text("anchor_date").notNull(),
  monthDay: integer("month_day"),
  tz: text("tz").notNull(),
  autoAdd: integer("auto_add", { mode: "boolean" }).notNull(),
  endDate: text("end_date"),
  paused: integer("paused", { mode: "boolean" }).notNull().default(false),
  lastGeneratedDate: text("last_generated_date"),
});

// !!! FTS WARNING !!!
// `receipts_fts` (external-content FTS5) is kept in sync by triggers
// receipts_fts_ai / _ad / _au defined in migrations/0001_fts.sql. Any migration
// that rebuilds `receipts` (drizzle-kit "recreate" pattern: CREATE __new_receipts;
// INSERT..SELECT; DROP receipts; RENAME) drops those triggers and may change
// rowids. Such a migration MUST re-create the three triggers and then run
//   INSERT INTO receipts_fts(receipts_fts) VALUES('rebuild');
// The same applies to any restore path that copies receipt rows.
// migrations.test.ts asserts the triggers exist after a full migrate.
export const receipts = sqliteTable(
  "receipts",
  {
    ...base,
    merchant: text("merchant"),
    purchasedAtLocal: text("purchased_at_local").notNull(),
    purchasedTz: text("purchased_tz"),
    purchasedAtUtc: integer("purchased_at_utc").notNull(),
    scannedAtUtc: integer("scanned_at_utc").notNull(),
    scannedTz: text("scanned_tz"),
    currency: text("currency").notNull(),
    totalMinor: integer("total_minor").notNull(),
    taxMinor: integer("tax_minor"),
    fxRate: text("fx_rate"),
    fxRateDate: text("fx_rate_date"),
    homeCurrencyAtSave: text("home_currency_at_save"),
    amountHomeMinor: integer("amount_home_minor"),
    fxApproximate: integer("fx_approximate", { mode: "boolean" }).notNull().default(false),
    categoryId: text("category_id"),
    folderId: text("folder_id"),
    notes: text("notes"),
    refNo: text("ref_no"),
    rawOcrText: text("raw_ocr_text"),
    parseSource: text("parse_source").$type<ParseSource>().notNull(),
    parseConfidence: text("parse_confidence"), // JSON
    status: text("status").$type<ReceiptStatus>().notNull().default("draft"),
    recurringRuleId: text("recurring_rule_id"),
    recurringDate: text("recurring_date"),
  },
  (t) => [
    index("receipts_purchased_at_utc_idx").on(t.purchasedAtUtc),
    index("receipts_folder_id_idx").on(t.folderId),
    index("receipts_category_id_idx").on(t.categoryId),
    index("receipts_ref_no_idx").on(t.refNo),
    index("receipts_status_local_idx").on(t.status, t.purchasedAtLocal),
    uniqueIndex("receipts_recurring_occurrence_uq")
      .on(t.recurringRuleId, t.recurringDate)
      .where(sql`deleted_at IS NULL AND recurring_rule_id IS NOT NULL`),
  ],
);

export const receiptPages = sqliteTable(
  "receipt_pages",
  {
    ...base,
    receiptId: text("receipt_id").notNull(),
    pageIndex: integer("page_index").notNull(),
    imagePath: text("image_path").notNull(),
    thumbPath: text("thumb_path"),
    width: integer("width"),
    height: integer("height"),
    dhash: text("dhash"),
  },
  (t) => [
    index("receipt_pages_receipt_id_idx").on(t.receiptId),
    index("receipt_pages_dhash_idx").on(t.dhash),
  ],
);

export const lineItems = sqliteTable(
  "line_items",
  {
    ...base,
    receiptId: text("receipt_id").notNull(),
    description: text("description").notNull(),
    qty: integer("qty"),
    amountMinor: integer("amount_minor").notNull(),
  },
  (t) => [index("line_items_receipt_id_idx").on(t.receiptId)],
);
