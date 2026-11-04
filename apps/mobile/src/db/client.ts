import { drizzle } from "drizzle-orm/expo-sqlite/driver";
import * as SQLite from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";

import * as schema from "./schema";
import type { AppDb } from "./types";

export const DB_NAME = "meb.db";

export class DbKeyMismatchError extends Error {
  constructor() {
    super("Database cannot be unlocked with the current key.");
    this.name = "DbKeyMismatchError";
  }
}

// Observed wrong-key error: "Error code 26: file is not a database" (docs/spikes/2026-11-sqlcipher.md).
function isWrongKeyError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return message.includes("file is not a database") || /\bcode 26\b/.test(message);
}

/**
 * Opens the SQLCipher DB and verifies the key. Never deletes or recreates the file:
 * a wrong key surfaces as DbKeyMismatchError and the file is left untouched.
 */
export function openDatabase(opts: {
  name?: string;
  keyHex: string;
  open?: (name: string) => SQLiteDatabase;
}): AppDb {
  if (!/^[0-9a-f]{64}$/.test(opts.keyHex)) throw new Error("Invalid database key format.");
  const open = opts.open ?? ((n: string) => SQLite.openDatabaseSync(n));
  const raw = open(opts.name ?? DB_NAME);
  try {
    raw.execSync(`PRAGMA key = "x'${opts.keyHex}'"`);
    // PRAGMA key never fails; the first real read does.
    raw.getFirstSync("SELECT count(*) FROM sqlite_master");
  } catch (e) {
    try {
      raw.closeSync();
    } catch {
      // ignore close failure; original error matters
    }
    if (isWrongKeyError(e)) throw new DbKeyMismatchError();
    throw e;
  }
  return drizzle(raw, { schema }) as unknown as AppDb;
}

/**
 * Deletes the DB file (and -wal/-shm if present). Only for the explicit, confirmed
 * reset on the db-error screen.
 */
export function deleteDatabaseFiles(name: string = DB_NAME): void {
  SQLite.deleteDatabaseSync(name);
  for (const suffix of ["-wal", "-shm"]) {
    try {
      SQLite.deleteDatabaseSync(name + suffix);
    } catch {
      // sidecar not present
    }
  }
}
