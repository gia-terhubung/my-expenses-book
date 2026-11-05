import { drizzle } from "drizzle-orm/expo-sqlite/driver";
import * as SQLite from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";

import {
  deriveKey,
  getOrCreateMasterKey,
  resetMasterKey,
  toHex,
  type SecretStore,
} from "@/crypto/keys";

import * as schema from "./schema";
import type { AppDb } from "./types";

export const DB_NAME = "meb.db";

export class DbKeyMismatchError extends Error {
  constructor() {
    super("Database cannot be unlocked with the current key.");
    this.name = "DbKeyMismatchError";
  }
}

export class DbNotEncryptedError extends Error {
  constructor() {
    super("SQLCipher is not available in this build; refusing to open an unencrypted database.");
    this.name = "DbNotEncryptedError";
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
  const closeQuietly = () => {
    try {
      raw.closeSync();
    } catch (e) {
      if (typeof __DEV__ !== "undefined" && __DEV__) console.warn("closeSync failed", e);
    }
  };
  try {
    // Without SQLCipher, PRAGMA key silently no-ops and the DB would be plaintext.
    const cipher = raw.getFirstSync<{ cipher_version?: string }>("PRAGMA cipher_version");
    if (!cipher?.cipher_version) throw new DbNotEncryptedError();
    raw.execSync(`PRAGMA key = "x'${opts.keyHex}'"`);
    // PRAGMA key never fails; the first real read does.
    raw.getFirstSync("SELECT count(*) FROM sqlite_master");
  } catch (e) {
    closeQuietly();
    if (isWrongKeyError(e)) throw new DbKeyMismatchError();
    throw e;
  }
  return drizzle(raw, { schema }) as unknown as AppDb;
}

/** Loads/creates the master key, derives the db key and opens the DB. */
export async function openWithStore(opts: {
  store: SecretStore;
  open?: (name: string) => SQLiteDatabase;
}): Promise<AppDb> {
  const master = await getOrCreateMasterKey(opts.store);
  return openDatabase({ keyHex: toHex(deriveKey(master, "db")), open: opts.open });
}

function isNotFoundError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return /not found|no such file|does not exist/i.test(message);
}

/**
 * Deletes the DB file (native delete also removes -wal/-shm). A missing file counts as
 * already deleted; any other error is rethrown.
 */
export function deleteDatabaseFiles(
  name: string = DB_NAME,
  del: (name: string) => void = (n) => SQLite.deleteDatabaseSync(n),
): void {
  try {
    del(name);
  } catch (e) {
    if (!isNotFoundError(e)) throw e;
  }
}

/**
 * Confirmed "erase all local app data": DB files, then prefs, then the master key. If a
 * delete fails the key is kept, so the data is not left unreadable-but-present.
 * wipePrefs is injected so this module stays free of the native MMKV import.
 * wipeImages (encrypted page files) runs after the DB files and before the key, so a failure
 * keeps the key and the pages stay readable.
 */
export async function resetLocalData(opts: {
  store: SecretStore;
  wipePrefs: () => void;
  deleteFiles?: () => void;
  wipeImages?: () => void;
}): Promise<void> {
  (opts.deleteFiles ?? (() => deleteDatabaseFiles()))();
  opts.wipeImages?.();
  opts.wipePrefs();
  await resetMasterKey(opts.store);
}
