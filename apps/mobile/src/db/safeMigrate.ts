import { sql } from "drizzle-orm";

import type { AppDb } from "./types";

/** Whole-file operations on the DB directory. Paths are plain filesystem paths. */
export interface DbFileOps {
  exists(path: string): boolean;
  copy(from: string, to: string): void; // throws on failure (e.g. ENOSPC); overwrites `to`
  remove(path: string): void; // no-op if missing
  move(from: string, to: string): void; // rename over `to`; throws on failure
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
 * Puts the pre-upgrade copy back without the DB file ever being absent: the copy is duplicated
 * to `<db>.restoring` first, then the handle is closed, the WAL/SHM sidecars of the failed run
 * are removed (so their pages are not replayed onto the restored file) and `.restoring` is
 * moved over the DB. `.pre-upgrade` is kept. Returns the reopened handle. Rejects (copy kept,
 * `.restoring` dropped) when the copy or the close fails; a failed move also rejects, and the
 * next launch restores from the kept copy.
 */
async function restore(opts: {
  db: AppDb;
  dbPath: string;
  files: DbFileOps;
  close: (db: AppDb) => void;
  reopen: () => AppDb | Promise<AppDb>;
}): Promise<AppDb> {
  const { dbPath, files } = opts;
  const restoringPath = `${dbPath}.restoring`;
  const dropRestoring = () => {
    try {
      files.remove(restoringPath);
    } catch {
      // the next launch removes it
    }
  };
  try {
    files.copy(preUpgradePath(dbPath), restoringPath);
  } catch (e) {
    dropRestoring();
    throw e;
  }
  try {
    // Must throw when the handle stays open: moving a file under a live connection corrupts it.
    opts.close(opts.db);
  } catch (e) {
    dropRestoring();
    throw e;
  }
  files.remove(`${dbPath}-wal`);
  files.remove(`${dbPath}-shm`);
  files.move(restoringPath, dbPath);
  return await opts.reopen();
}

/**
 * Runs pending migrations behind a copy of the DB file.
 * - A leftover copy next to a DB that looks fresh (file missing or 0 applied migrations) means
 *   an earlier restore did not finish: restore from the copy (restored). Never delete it then.
 * - Nothing pending with at least 1 applied: removes a leftover copy, returns ok.
 * - Fresh install (0 applied, no copy): no data to protect, migrates without a copy.
 * - Otherwise: checkpoint, copy to `<dbPath>.pre-upgrade`, migrate. The copy is kept until a
 *   later launch has nothing pending. If the copy fails nothing is migrated (noSpace). If the
 *   migration fails the copy is put back and the DB reopened (restored).
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

  files.remove(`${dbPath}.restoring`); // stale from an interrupted restore

  const applied = appliedMigrationCount(db);
  if (files.exists(copyPath) && (applied === 0 || !files.exists(dbPath))) {
    const reopened = await restore(opts);
    return {
      status: "restored",
      error: new Error("Recovered the database from the pre-upgrade copy."),
      db: reopened,
    };
  }

  if (opts.pendingCount(db) <= 0) {
    if (applied >= 1) {
      try {
        files.remove(copyPath);
      } catch {
        // A leftover copy is harmless; the next clean launch tries again.
      }
    }
    return { status: "ok" };
  }

  if (applied === 0) {
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
    const reopened = await restore(opts);
    return { status: "restored", error, db: reopened };
  }
}
