import { sql } from "drizzle-orm";

import type { AppDb } from "./types";

/** Whole-file operations on the DB directory. Paths are plain filesystem paths. */
export interface DbFileOps {
  exists(path: string): boolean;
  copy(from: string, to: string): void; // throws on failure (e.g. ENOSPC); overwrites `to`
  remove(path: string): void; // no-op if missing
}

export type MigrateOutcome =
  | { status: "ok" }
  | { status: "restored"; error: Error; db: AppDb } // migration failed, copy put back; `db` is the reopened handle
  | { status: "noSpace"; error: Error }; // copy failed, nothing migrated

const MIGRATIONS_TABLE = "__drizzle_migrations";

/** The single pre-upgrade copy sits next to the DB file. */
export const preUpgradePath = (dbPath: string): string => `${dbPath}.pre-upgrade`;

/** Rows in __drizzle_migrations; 0 when the table does not exist yet (fresh install). */
export function appliedMigrationCount(db: AppDb): number {
  const table = db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${MIGRATIONS_TABLE}`,
  );
  if (table.length === 0) return 0;
  const row = db.all<{ n: number }>(sql.raw(`SELECT count(*) AS n FROM "${MIGRATIONS_TABLE}"`))[0];
  return Number(row?.n ?? 0);
}

/** Journal entries minus applied rows (a missing table means 0 applied). */
export function pendingMigrationCount(journal: { entries: readonly unknown[] }): (db: AppDb) => number {
  return (db) => Math.max(0, journal.entries.length - appliedMigrationCount(db));
}

/** Folds the WAL into the main file so a byte copy of that file is complete. */
function checkpoint(db: AppDb): void {
  const rows = db.all<{ busy: number }>(sql.raw("PRAGMA wal_checkpoint(TRUNCATE)"));
  if (Number(rows[0]?.busy ?? 0) !== 0) {
    throw new Error("Could not checkpoint the database before upgrading.");
  }
}

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * Runs pending migrations behind a copy of the DB file.
 * - Nothing pending: removes a leftover copy, returns ok.
 * - Fresh install (0 applied): no data to protect, migrates without a copy.
 * - Otherwise: checkpoint, copy to `<dbPath>.pre-upgrade`, migrate. The copy is kept until a
 *   later launch has nothing pending. If the copy fails nothing is migrated (noSpace). If the
 *   migration fails the handle is closed, the copy is put back and the DB reopened (restored).
 * A failure while putting the copy back or reopening rejects; the copy is kept in that case.
 */
export async function safeMigrate(opts: {
  db: AppDb;
  dbPath: string;
  files: DbFileOps;
  pendingCount: (db: AppDb) => number;
  runMigrations: (db: AppDb) => Promise<void>;
  close: (db: AppDb) => void;
  reopen: () => AppDb | Promise<AppDb>;
}): Promise<MigrateOutcome> {
  const { db, dbPath, files } = opts;
  const copyPath = preUpgradePath(dbPath);

  if (opts.pendingCount(db) <= 0) {
    try {
      files.remove(copyPath);
    } catch {
      // A leftover copy is harmless; the next clean launch tries again.
    }
    return { status: "ok" };
  }

  if (appliedMigrationCount(db) === 0) {
    await opts.runMigrations(db);
    return { status: "ok" };
  }

  checkpoint(db);
  try {
    files.remove(copyPath);
    files.copy(dbPath, copyPath);
  } catch (e) {
    try {
      files.remove(copyPath); // never leave a partial copy that looks complete
    } catch {
      // nothing else to do; the DB itself is untouched
    }
    return { status: "noSpace", error: toError(e) };
  }

  try {
    await opts.runMigrations(db);
    return { status: "ok" };
  } catch (e) {
    const error = toError(e);
    opts.close(db);
    // Journal files belong to the failed run; the copy was taken with an empty WAL.
    files.remove(`${dbPath}-wal`);
    files.remove(`${dbPath}-shm`);
    files.copy(copyPath, dbPath);
    const reopened = await opts.reopen();
    return { status: "restored", error, db: reopened };
  }
}
