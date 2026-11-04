import fs from "node:fs";
import os from "node:os";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";
import { migrationsFolder } from "./testing/testDb";
import type { AppDb } from "./types";
import { searchReceipts } from "./repositories/receipts";

const RECEIPT_SQL = `INSERT INTO receipts (id, created_at, updated_at, version, merchant, purchased_at_local,
  purchased_at_utc, scanned_at_utc, currency, total_minor, parse_source, status, fx_approximate, raw_ocr_text)
  VALUES ('r1', 1, 1, 1, 'Indomaret', '2026-01-01T00:00:00', 1, 1, 'IDR', 1000, 'manual', 'draft', 0, 'kopi susu')`;

describe("migrations", () => {
  it("upgrade from N-1 keeps data intact and searchable", () => {
    const journal = JSON.parse(fs.readFileSync(`${migrationsFolder}/meta/_journal.json`, "utf8"));
    const n = journal.entries.length;
    expect(n).toBeGreaterThanOrEqual(2);

    // Copy of migrations folder minus the last entry.
    const tmp = fs.mkdtempSync(`${os.tmpdir()}/meb-mig-`);
    fs.cpSync(migrationsFolder, tmp, { recursive: true });
    const partial = { ...journal, entries: journal.entries.slice(0, n - 1) };
    fs.writeFileSync(`${tmp}/meta/_journal.json`, JSON.stringify(partial));

    const raw = new Database(":memory:");
    const db = drizzle(raw, { schema });
    migrate(db, { migrationsFolder: tmp });
    raw.exec(RECEIPT_SQL);

    migrate(db, { migrationsFolder });

    expect(raw.prepare("SELECT merchant FROM receipts WHERE id='r1'").get()).toEqual({
      merchant: "Indomaret",
    });
    // Last migration rebuilds the index, so pre-existing rows are searchable.
    expect(searchReceipts(db as unknown as AppDb, "indom")).toHaveLength(1);
    expect(searchReceipts(db as unknown as AppDb, "kopi")).toHaveLength(1);
  });

  it("re-running migrate is a no-op and keeps data", () => {
    const raw = new Database(":memory:");
    const db = drizzle(raw, { schema });
    migrate(db, { migrationsFolder });
    raw.exec(RECEIPT_SQL);
    migrate(db, { migrationsFolder });
    expect(raw.prepare("SELECT count(*) c FROM receipts").get()).toEqual({ c: 1 });
    expect(raw.prepare("SELECT count(*) c FROM categories").get()).toEqual({ c: 10 });
    expect(searchReceipts(db as unknown as AppDb, "indom")).toHaveLength(1);
  });
});
