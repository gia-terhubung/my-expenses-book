import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type * as schema from "./schema";

/** Sync SQLite Drizzle DB: better-sqlite3 in tests, expo-sqlite on device. */
export type AppDb = BaseSQLiteDatabase<"sync", any, typeof schema>;

export type Receipt = typeof schema.receipts.$inferSelect;
export type ReceiptPage = typeof schema.receiptPages.$inferSelect;
export type Category = typeof schema.categories.$inferSelect;
export type LineItem = typeof schema.lineItems.$inferSelect;
export type Folder = typeof schema.folders.$inferSelect;

type SyncColumns = "id" | "createdAt" | "updatedAt" | "deletedAt" | "version";
export type NewReceiptInput = Omit<typeof schema.receipts.$inferInsert, SyncColumns>;
