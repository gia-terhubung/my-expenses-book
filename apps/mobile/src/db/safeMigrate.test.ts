import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";
import { migrationsFolder, testDb } from "./testing/testDb";
import type { AppDb } from "./types";
import { pendingMigrationCount, safeMigrate, type DbFileOps } from "./safeMigrate";

const DB_PATH = "/data/SQLite/meb.db";
const COPY_PATH = `${DB_PATH}.pre-upgrade`;
const RESTORING_PATH = `${DB_PATH}.restoring`;

function fakeFiles(initial: Record<string, string> = {}) {
  const map = new Map<string, Uint8Array>(
    Object.entries(initial).map(([p, s]) => [p, new TextEncoder().encode(s)]),
  );
  // Every op after which the DB file was absent (it must never be, once it existed).
  const dbAbsentAfter: string[] = [];
  const hadDb = map.has(DB_PATH);
  const track = (name: string) => {
    if (hadDb && !map.has(DB_PATH)) dbAbsentAfter.push(name);
  };
  const ops = {
    exists: jest.fn((p: string) => map.has(p)),
    copy: jest.fn((from: string, to: string) => {
      const bytes = map.get(from);
      if (!bytes) throw new Error(`missing ${from}`);
      map.set(to, new Uint8Array(bytes));
      track(`copy ${from} -> ${to}`);
    }),
    remove: jest.fn((p: string) => {
      map.delete(p);
      track(`remove ${p}`);
    }),
    // Atomic rename: the destination is replaced in one step.
    move: jest.fn((from: string, to: string) => {
      const bytes = map.get(from);
      if (!bytes) throw new Error(`missing ${from}`);
      map.set(to, bytes);
      map.delete(from);
      track(`move ${from} -> ${to}`);
    }),
  } satisfies DbFileOps;
  const text = (p: string) => (map.has(p) ? new TextDecoder().decode(map.get(p)) : undefined);
  return { map, ops, text, dbAbsentAfter };
}

const close = (db: AppDb) => (db as unknown as { $client: Database.Database }).$client.close();

function emptyDb(): AppDb {
  return drizzle(new Database(":memory:"), { schema }) as unknown as AppDb;
}

function journalEntries(): number {
  return JSON.parse(fs.readFileSync(`${migrationsFolder}/meta/_journal.json`, "utf8")).entries.length;
}

describe("pendingMigrationCount", () => {
  const journal = JSON.parse(fs.readFileSync(`${migrationsFolder}/meta/_journal.json`, "utf8"));

  it("is 0 on a fully migrated db", () => {
    expect(pendingMigrationCount(journal)(testDb())).toBe(0);
  });

  it("counts every journal entry when __drizzle_migrations is missing", () => {
    expect(pendingMigrationCount(journal)(emptyDb())).toBe(journalEntries());
  });
});

describe("safeMigrate", () => {
  it("no pending migrations: no copy, ok", async () => {
    const { ops } = fakeFiles({ [DB_PATH]: "v1" });
    const runMigrations = jest.fn(async () => {});
    const outcome = await safeMigrate({
      db: testDb(),
      dbPath: DB_PATH,
      files: ops,
      pendingCount: () => 0,
      runMigrations,
      close,
      reopen: () => testDb(),
    });
    expect(outcome).toEqual({ status: "ok" });
    expect(ops.copy).not.toHaveBeenCalled();
    expect(runMigrations).not.toHaveBeenCalled();
  });

  it("fresh install (0 applied): no copy, ok", async () => {
    const { ops } = fakeFiles({ [DB_PATH]: "" });
    const runMigrations = jest.fn(async () => {});
    const outcome = await safeMigrate({
      db: emptyDb(),
      dbPath: DB_PATH,
      files: ops,
      pendingCount: () => journalEntries(),
      runMigrations,
      close,
      reopen: () => testDb(),
    });
    expect(outcome).toEqual({ status: "ok" });
    expect(ops.copy).not.toHaveBeenCalled();
    expect(runMigrations).toHaveBeenCalledTimes(1);
  });

  it("pending + existing data: copies first, migrates, returns ok, keeps the copy", async () => {
    const { ops, text } = fakeFiles({ [DB_PATH]: "v1" });
    const runMigrations = jest.fn(async () => {
      expect(text(COPY_PATH)).toBe("v1");
    });
    const outcome = await safeMigrate({
      db: testDb(),
      dbPath: DB_PATH,
      files: ops,
      pendingCount: () => 1,
      runMigrations,
      close,
      reopen: () => testDb(),
    });
    expect(outcome).toEqual({ status: "ok" });
    expect(ops.copy).toHaveBeenCalledTimes(1);
    expect(ops.copy).toHaveBeenCalledWith(DB_PATH, COPY_PATH);
    expect(runMigrations).toHaveBeenCalledTimes(1);
    expect(ops.copy.mock.invocationCallOrder[0]).toBeLessThan(runMigrations.mock.invocationCallOrder[0]);
    expect(text(COPY_PATH)).toBe("v1");
  });

  it("next launch with nothing pending removes a leftover copy", async () => {
    const { ops, map } = fakeFiles({ [DB_PATH]: "v2", [COPY_PATH]: "v1" });
    const outcome = await safeMigrate({
      db: testDb(),
      dbPath: DB_PATH,
      files: ops,
      pendingCount: () => 0,
      runMigrations: async () => {},
      close,
      reopen: () => testDb(),
    });
    expect(outcome).toEqual({ status: "ok" });
    expect(map.has(COPY_PATH)).toBe(false);
    expect(map.has(DB_PATH)).toBe(true);
  });

  it("migration throws: restores the copy, reopens, returns restored", async () => {
    const { ops, map, text } = fakeFiles({ [DB_PATH]: "v1" });
    const preUpgrade = new Uint8Array(map.get(DB_PATH)!);
    const boom = new Error("no such column: pay_day");
    const db = testDb();
    const reopened = testDb();
    const closeSpy = jest.fn(close);
    const reopen = jest.fn(() => reopened);
    const outcome = await safeMigrate({
      db,
      dbPath: DB_PATH,
      files: ops,
      pendingCount: () => 1,
      runMigrations: async () => {
        // A half-applied upgrade leaves the main file and a WAL behind.
        map.set(DB_PATH, new TextEncoder().encode("v1-half-migrated"));
        map.set(`${DB_PATH}-wal`, new TextEncoder().encode("frames"));
        throw boom;
      },
      close: closeSpy,
      reopen,
    });
    expect(outcome).toEqual({ status: "restored", error: boom, db: reopened });
    expect(map.get(DB_PATH)).toEqual(preUpgrade);
    expect(text(DB_PATH)).toBe("v1");
    expect(map.has(`${DB_PATH}-wal`)).toBe(false);
    expect(closeSpy).toHaveBeenCalledWith(db);
    expect(reopen).toHaveBeenCalledTimes(1);
    // The old handle is closed before the file is replaced, and reopened after.
    expect(closeSpy.mock.invocationCallOrder[0]).toBeLessThan(ops.move.mock.invocationCallOrder[0]);
    expect(reopen.mock.invocationCallOrder[0]).toBeGreaterThan(ops.move.mock.invocationCallOrder[0]);
    // The copy stays until a later launch migrates cleanly.
    expect(map.has(COPY_PATH)).toBe(true);
  });

  it("restore copies to .restoring then moves it over the DB; the DB file is never absent", async () => {
    const { ops, map, text, dbAbsentAfter } = fakeFiles({ [DB_PATH]: "v1" });
    const outcome = await safeMigrate({
      db: testDb(),
      dbPath: DB_PATH,
      files: ops,
      pendingCount: () => 1,
      runMigrations: async () => {
        map.set(DB_PATH, new TextEncoder().encode("v1-half-migrated"));
        throw new Error("boom");
      },
      close,
      reopen: () => testDb(),
    });
    expect(outcome.status).toBe("restored");
    expect(ops.copy).toHaveBeenLastCalledWith(COPY_PATH, RESTORING_PATH);
    expect(ops.move).toHaveBeenCalledTimes(1);
    expect(ops.move).toHaveBeenCalledWith(RESTORING_PATH, DB_PATH);
    expect(ops.copy.mock.invocationCallOrder.at(-1)!).toBeLessThan(ops.move.mock.invocationCallOrder[0]);
    expect(ops.remove).not.toHaveBeenCalledWith(DB_PATH);
    expect(dbAbsentAfter).toEqual([]);
    expect(text(DB_PATH)).toBe("v1");
    expect(map.has(RESTORING_PATH)).toBe(false);
    expect(text(COPY_PATH)).toBe("v1");
  });

  it("restore removes the WAL and SHM after closing and before the move", async () => {
    const { ops, map } = fakeFiles({ [DB_PATH]: "v1" });
    const closeSpy = jest.fn(close);
    await safeMigrate({
      db: testDb(),
      dbPath: DB_PATH,
      files: ops,
      pendingCount: () => 1,
      runMigrations: async () => {
        map.set(`${DB_PATH}-wal`, new TextEncoder().encode("stale frames"));
        map.set(`${DB_PATH}-shm`, new TextEncoder().encode("stale index"));
        throw new Error("boom");
      },
      close: closeSpy,
      reopen: () => testDb(),
    });
    expect(map.has(`${DB_PATH}-wal`)).toBe(false);
    expect(map.has(`${DB_PATH}-shm`)).toBe(false);
    const removeOrder = (p: string) =>
      ops.remove.mock.invocationCallOrder[ops.remove.mock.calls.findIndex(([x]) => x === p)];
    for (const p of [`${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
      expect(removeOrder(p)).toBeGreaterThan(closeSpy.mock.invocationCallOrder[0]);
      expect(removeOrder(p)).toBeLessThan(ops.move.mock.invocationCallOrder[0]);
    }
  });

  it("a stale .restoring file is removed at start", async () => {
    const { ops, map } = fakeFiles({ [DB_PATH]: "v2", [RESTORING_PATH]: "junk" });
    await safeMigrate({
      db: testDb(),
      dbPath: DB_PATH,
      files: ops,
      pendingCount: () => 0,
      runMigrations: async () => {},
      close,
      reopen: () => testDb(),
    });
    expect(map.has(RESTORING_PATH)).toBe(false);
  });

  it("leftover copy + fresh-looking DB (0 applied): restores from the copy, keeps it, does not migrate", async () => {
    const { ops, text, dbAbsentAfter } = fakeFiles({ [DB_PATH]: "", [COPY_PATH]: "v1" });
    const reopened = testDb();
    const runMigrations = jest.fn(async () => {});
    const outcome = await safeMigrate({
      db: emptyDb(),
      dbPath: DB_PATH,
      files: ops,
      pendingCount: () => journalEntries(),
      runMigrations,
      close,
      reopen: () => reopened,
    });
    expect(outcome).toMatchObject({ status: "restored", db: reopened });
    expect(runMigrations).not.toHaveBeenCalled();
    expect(text(DB_PATH)).toBe("v1");
    expect(text(COPY_PATH)).toBe("v1");
    expect(ops.remove).not.toHaveBeenCalledWith(COPY_PATH);
    expect(dbAbsentAfter).toEqual([]);
  });

  it("leftover copy + missing DB file: restores from the copy", async () => {
    const { ops, text } = fakeFiles({ [COPY_PATH]: "v1" });
    const runMigrations = jest.fn(async () => {});
    const outcome = await safeMigrate({
      db: testDb(),
      dbPath: DB_PATH,
      files: ops,
      pendingCount: () => 0,
      runMigrations,
      close,
      reopen: () => testDb(),
    });
    expect(outcome.status).toBe("restored");
    expect(runMigrations).not.toHaveBeenCalled();
    expect(text(DB_PATH)).toBe("v1");
    expect(text(COPY_PATH)).toBe("v1");
  });

  it("copy throws: returns noSpace and runMigrations is never called", async () => {
    const { ops, map } = fakeFiles({ [DB_PATH]: "v1" });
    const enospc = new Error("ENOSPC: no space left on device");
    ops.copy.mockImplementationOnce((_from: string, to: string) => {
      map.set(to, new TextEncoder().encode("partial"));
      throw enospc;
    });
    const runMigrations = jest.fn(async () => {});
    const outcome = await safeMigrate({
      db: testDb(),
      dbPath: DB_PATH,
      files: ops,
      pendingCount: () => 1,
      runMigrations,
      close,
      reopen: () => testDb(),
    });
    expect(outcome).toEqual({ status: "noSpace", error: enospc });
    expect(runMigrations).not.toHaveBeenCalled();
    // A partial copy is not left behind.
    expect(map.has(COPY_PATH)).toBe(false);
    expect(map.has(DB_PATH)).toBe(true);
  });

  it("reopen failing after a restore rejects with the reopen error", async () => {
    const { ops, text } = fakeFiles({ [DB_PATH]: "v1" });
    const reopenError = new Error("cannot open");
    await expect(
      safeMigrate({
        db: testDb(),
        dbPath: DB_PATH,
        files: ops,
        pendingCount: () => 1,
        runMigrations: async () => {
          throw new Error("migration failed");
        },
        close,
        reopen: () => {
          throw reopenError;
        },
      }),
    ).rejects.toBe(reopenError);
    expect(text(DB_PATH)).toBe("v1");
  });

  describe("a failure while putting the copy back rejects and keeps the copy", () => {
    const failingUpgrade = async () => {
      throw new Error("migration failed");
    };

    it("copy to .restoring throws: the DB handle is not closed, .restoring is removed", async () => {
      const { ops, map, text } = fakeFiles({ [DB_PATH]: "v1" });
      const enospc = new Error("ENOSPC");
      const closeSpy = jest.fn(close);
      const runMigrations = jest.fn(async () => {
        map.set(DB_PATH, new TextEncoder().encode("v1-half-migrated"));
        ops.copy.mockImplementationOnce((_from: string, to: string) => {
          map.set(to, new TextEncoder().encode("partial"));
          throw enospc;
        });
        throw new Error("migration failed");
      });
      await expect(
        safeMigrate({ db: testDb(), dbPath: DB_PATH, files: ops, pendingCount: () => 1, runMigrations, close: closeSpy, reopen: () => testDb() }),
      ).rejects.toBe(enospc);
      expect(closeSpy).not.toHaveBeenCalled();
      expect(ops.move).not.toHaveBeenCalled();
      expect(map.has(RESTORING_PATH)).toBe(false);
      expect(text(COPY_PATH)).toBe("v1");
      expect(text(DB_PATH)).toBe("v1-half-migrated");
    });

    it("close throws: rejects with it, .restoring is removed, the DB file is untouched", async () => {
      const { ops, map, text } = fakeFiles({ [DB_PATH]: "v1" });
      const busy = new Error("unable to close due to unfinalized statements");
      const reopen = jest.fn(() => testDb());
      await expect(
        safeMigrate({
          db: testDb(),
          dbPath: DB_PATH,
          files: ops,
          pendingCount: () => 1,
          runMigrations: failingUpgrade,
          close: () => {
            throw busy;
          },
          reopen,
        }),
      ).rejects.toBe(busy);
      expect(ops.move).not.toHaveBeenCalled();
      expect(reopen).not.toHaveBeenCalled();
      expect(map.has(RESTORING_PATH)).toBe(false);
      expect(text(DB_PATH)).toBe("v1");
      expect(text(COPY_PATH)).toBe("v1");
    });

    it("move throws: rejects, the copy stays and the next launch restores from it", async () => {
      const { ops, map, text } = fakeFiles({ [DB_PATH]: "v1" });
      const moveError = new Error("EIO");
      ops.move.mockImplementationOnce(() => {
        throw moveError;
      });
      await expect(
        safeMigrate({
          db: testDb(),
          dbPath: DB_PATH,
          files: ops,
          pendingCount: () => 1,
          runMigrations: async () => {
            map.set(DB_PATH, new TextEncoder().encode(""));
            throw new Error("migration failed");
          },
          close,
          reopen: () => testDb(),
        }),
      ).rejects.toBe(moveError);
      expect(text(COPY_PATH)).toBe("v1");
      // Next launch: the DB looks fresh (0 applied) next to the copy, so it restores.
      const next = await safeMigrate({
        db: emptyDb(),
        dbPath: DB_PATH,
        files: ops,
        pendingCount: () => journalEntries(),
        runMigrations: jest.fn(async () => {}),
        close,
        reopen: () => testDb(),
      });
      expect(next.status).toBe("restored");
      expect(text(DB_PATH)).toBe("v1");
      expect(map.has(RESTORING_PATH)).toBe(false);
    });
  });
});

/** Real files: a WAL-mode db on disk, an upgrade that damages data and then throws. */
describe("safeMigrate on a real file", () => {
  const nodeFiles: DbFileOps = {
    exists: (p) => fs.existsSync(p),
    copy: (from, to) => fs.copyFileSync(from, to),
    remove: (p) => fs.rmSync(p, { force: true }),
    move: (from, to) => fs.renameSync(from, to),
  };

  function openFile(p: string): AppDb {
    const raw = new Database(p);
    raw.pragma("journal_mode = WAL");
    return drizzle(raw, { schema }) as unknown as AppDb;
  }

  it("restores the pre-upgrade data after a failed upgrade", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meb-safe-"));
    const dbPath = path.join(dir, "meb.db");
    const db = openFile(dbPath);
    migrate(db as never, { migrationsFolder });
    const raw = (db as unknown as { $client: Database.Database }).$client;
    raw.exec(`INSERT INTO receipts (id, created_at, updated_at, version, merchant, purchased_at_local,
      purchased_at_utc, scanned_at_utc, currency, total_minor, parse_source, status, fx_approximate)
      VALUES ('r1', 1, 1, 1, 'Indomaret', '2026-01-01T00:00:00', 1, 1, 'IDR', 1000, 'manual', 'draft', 0)`);
    // The row lives only in the WAL until a checkpoint.
    expect(fs.statSync(`${dbPath}-wal`).size).toBeGreaterThan(0);

    const outcome = await safeMigrate({
      db,
      dbPath,
      files: nodeFiles,
      pendingCount: () => 1,
      runMigrations: async (d) => {
        const r = (d as unknown as { $client: Database.Database }).$client;
        r.exec("DELETE FROM receipts");
        throw new Error("upgrade failed half way");
      },
      close,
      reopen: () => openFile(dbPath),
    });

    expect(outcome.status).toBe("restored");
    if (outcome.status !== "restored") throw new Error("unreachable");
    const reopenedRaw = (outcome.db as unknown as { $client: Database.Database }).$client;
    expect(reopenedRaw.prepare("SELECT merchant FROM receipts").all()).toEqual([{ merchant: "Indomaret" }]);
    expect(fs.existsSync(`${dbPath}.pre-upgrade`)).toBe(true);
    reopenedRaw.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
