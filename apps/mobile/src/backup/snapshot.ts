import { z } from "zod";

import journal from "@/db/migrations/meta/_journal.json";
import * as schema from "@/db/schema";
import type { AppDb, Category, Folder, LineItem, Receipt, ReceiptPage } from "@/db/types";
import type { PrefsStore } from "@/prefs/prefs";

/** One entry per applied migration; bumps automatically with every new migration. */
export const SCHEMA_VERSION: number = journal.entries.length;

export type Snapshot = {
  schemaVersion: number;
  prefs: { homeCurrency: string | null; taxYearStartMonth: number };
  categories: Category[];
  folders: Folder[];
  receipts: Receipt[];
  receiptPages: ReceiptPage[];
  lineItems: LineItem[];
};

const int = z.number().int();
const base = {
  id: z.string(),
  createdAt: int,
  updatedAt: int,
  deletedAt: int.nullable(),
  version: int,
};

export const categoryShape = z
  .object({
    ...base,
    nameKey: z.string().nullable(),
    customName: z.string().nullable(),
    icon: z.string().nullable(),
    color: z.string().nullable(),
    isDefault: z.boolean(),
    sortOrder: int,
  })
  .strict();

export const folderShape = z
  .object({
    ...base,
    name: z.string(),
    kind: z.enum(["project", "trip"]),
    defaultCurrency: z.string().nullable(),
  })
  .strict();

export const receiptShape = z
  .object({
    ...base,
    merchant: z.string().nullable(),
    purchasedAtLocal: z.string(),
    purchasedTz: z.string().nullable(),
    purchasedAtUtc: int,
    scannedAtUtc: int,
    scannedTz: z.string().nullable(),
    currency: z.string(),
    totalMinor: int,
    taxMinor: int.nullable(),
    fxRate: z.string().nullable(),
    fxRateDate: z.string().nullable(),
    homeCurrencyAtSave: z.string().nullable(),
    amountHomeMinor: int.nullable(),
    fxApproximate: z.boolean(),
    categoryId: z.string().nullable(),
    folderId: z.string().nullable(),
    notes: z.string().nullable(),
    refNo: z.string().nullable(),
    rawOcrText: z.string().nullable(),
    parseSource: z.enum(["apple_fm", "gemini_nano", "heuristic", "manual"]),
    parseConfidence: z.string().nullable(),
    status: z.enum(["draft", "confirmed"]),
    // Optional so backups made before recurring rules (schema < 5) still parse.
    recurringRuleId: z.string().nullable().default(null),
    recurringDate: z.string().nullable().default(null),
  })
  .strict();

export const receiptPageShape = z
  .object({
    ...base,
    receiptId: z.string(),
    pageIndex: int,
    imagePath: z.string(),
    thumbPath: z.string().nullable(),
    width: int.nullable(),
    height: int.nullable(),
    dhash: z.string().nullable(),
  })
  .strict();

export const lineItemShape = z
  .object({
    ...base,
    receiptId: z.string(),
    description: z.string(),
    qty: int.nullable(),
    amountMinor: int,
  })
  .strict();

export const snapshotSchema = z
  .object({
    schemaVersion: int,
    prefs: z.object({ homeCurrency: z.string().nullable(), taxYearStartMonth: int }).strict(),
    categories: z.array(categoryShape),
    folders: z.array(folderShape),
    receipts: z.array(receiptShape),
    receiptPages: z.array(receiptPageShape),
    lineItems: z.array(lineItemShape),
  })
  .strict();

/** Every row of every table, soft-deleted included. */
export function collectSnapshot(db: AppDb, prefs: PrefsStore): Snapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    prefs: { homeCurrency: prefs.get("homeCurrency"), taxYearStartMonth: prefs.get("taxYearStartMonth") },
    categories: db.select().from(schema.categories).all(),
    folders: db.select().from(schema.folders).all(),
    receipts: db.select().from(schema.receipts).all(),
    receiptPages: db.select().from(schema.receiptPages).all(),
    lineItems: db.select().from(schema.lineItems).all(),
  };
}
