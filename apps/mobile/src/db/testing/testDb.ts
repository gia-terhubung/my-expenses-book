import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "../schema";
import type { AppDb } from "../types";

export const migrationsFolder = path.join(__dirname, "..", "migrations");

export function testDb(): AppDb {
  const db = drizzle(new Database(":memory:"), { schema });
  migrate(db, { migrationsFolder });
  return db as unknown as AppDb;
}
