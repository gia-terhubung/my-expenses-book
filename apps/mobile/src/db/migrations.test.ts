import fs from "node:fs";
import os from "node:os";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";
import { migrationsFolder, testDb } from "./testing/testDb";
import type { AppDb } from "./types";
import { listCategories } from "./repositories/categories";
import {
  createReceipt,
  searchReceipts,
  updateReceipt,
} from "./repositories/receipts";

const RECEIPT_SQL = `INSERT INTO receipts (id, created_at, updated_at, version, merchant, purchased_at_local,
  purchased_at_utc, scanned_at_utc, currency, total_minor, parse_source, status, fx_approximate, raw_ocr_text)
  VALUES ('r1', 1, 1, 1, 'Indomaret', '2026-01-01T00:00:00', 1, 1, 'IDR', 1000, 'manual', 'draft', 0, 'kopi susu')`;

describe("migrations", () => {
  it("upgrade from N-1 keeps data intact and searchable", () => {
    const journal = JSON.parse(
      fs.readFileSync(`${migrationsFolder}/meta/_journal.json`, "utf8"),
    );
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

    expect(
      raw.prepare("SELECT merchant FROM receipts WHERE id='r1'").get(),
    ).toEqual({
      merchant: "Indomaret",
    });
    // Last migration rebuilds the index, so pre-existing rows are searchable.
    expect(searchReceipts(db as unknown as AppDb, "indom")).toHaveLength(1);
    expect(searchReceipts(db as unknown as AppDb, "kopi")).toHaveLength(1);

    // Guard: a future table-recreate migration must not drop the FTS triggers.
    const triggers = raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name",
      )
      .all();
    expect(triggers).toEqual([
      { name: "receipts_fts_ad" },
      { name: "receipts_fts_ai" },
      { name: "receipts_fts_au" },
    ]);

    // Guard: insert + update through the repositories keep search in sync.
    const appDb = db as unknown as AppDb;
    const r = createReceipt(appDb, {
      merchant: "Alfamart",
      purchasedAtLocal: "2026-01-02T00:00:00",
      purchasedAtUtc: 2,
      scannedAtUtc: 2,
      currency: "IDR",
      totalMinor: 1,
      parseSource: "manual",
    });
    expect(searchReceipts(appDb, "alfa").map((x) => x.id)).toEqual([r.id]);
    updateReceipt(appDb, r.id, { merchant: "Circle K" });
    expect(searchReceipts(appDb, "alfa")).toEqual([]);
    expect(searchReceipts(appDb, "circle").map((x) => x.id)).toEqual([r.id]);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("re-running migrate is a no-op and keeps data", () => {
    const raw = new Database(":memory:");
    const db = drizzle(raw, { schema });
    migrate(db, { migrationsFolder });
    raw.exec(RECEIPT_SQL);
    migrate(db, { migrationsFolder });
    expect(raw.prepare("SELECT count(*) c FROM receipts").get()).toEqual({
      c: 1,
    });
    expect(raw.prepare("SELECT count(*) c FROM categories").get()).toEqual({
      c: 11,
    });
    expect(searchReceipts(db as unknown as AppDb, "indom")).toHaveLength(1);
  });

  it("0002 adds ref_no and dhash columns and keeps FTS triggers", () => {
    const raw = new Database(":memory:");
    const db = drizzle(raw, { schema });
    migrate(db, { migrationsFolder });
    const cols = (t: string) =>
      (raw.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map(
        (c) => c.name,
      );
    expect(cols("receipts")).toContain("ref_no");
    expect(cols("receipt_pages")).toContain("dhash");
    const triggers = raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name",
      )
      .all();
    expect(triggers).toEqual([
      { name: "receipts_fts_ad" },
      { name: "receipts_fts_ai" },
      { name: "receipts_fts_au" },
    ]);
  });

  it("seeds transfer category between office and other", () => {
    const ids = listCategories(testDb()).map((c) => c.id);
    expect(ids.indexOf("default:transfer")).toBeGreaterThan(
      ids.indexOf("default:office"),
    );
    expect(ids.indexOf("default:transfer")).toBe(
      ids.indexOf("default:other") - 1,
    );
  });

  describe("recurring rules schema", () => {
    const insertRecurring = (
      raw: Database.Database,
      id: string,
      rule: string | null,
      date: string | null,
    ) =>
      raw
        .prepare(
          `INSERT INTO receipts (id, created_at, updated_at, version, purchased_at_local, purchased_at_utc,
            scanned_at_utc, currency, total_minor, parse_source, status, fx_approximate, recurring_rule_id, recurring_date)
            VALUES (?, 1, 1, 1, '2026-01-01T00:00:00', 1, 1, 'IDR', 1, 'manual', 'confirmed', 0, ?, ?)`,
        )
        .run(id, rule, date);

    const migrated = () => {
      const raw = new Database(":memory:");
      migrate(drizzle(raw, { schema }), { migrationsFolder });
      return raw;
    };

    it("creates recurring_rules with the expected columns", () => {
      const raw = migrated();
      const cols = (
        raw.prepare("PRAGMA table_info(recurring_rules)").all() as {
          name: string;
        }[]
      ).map((c) => c.name);
      expect(cols).toEqual(
        expect.arrayContaining([
          "id",
          "created_at",
          "updated_at",
          "deleted_at",
          "version",
          "merchant",
          "currency",
          "total_minor",
          "tax_minor",
          "category_id",
          "folder_id",
          "notes",
          "frequency",
          "anchor_date",
          "month_day",
          "tz",
          "auto_add",
          "end_date",
          "paused",
          "last_generated_date",
        ]),
      );
      expect(cols).toHaveLength(20);
    });

    it("rejects two live receipts for the same occurrence", () => {
      const raw = migrated();
      insertRecurring(raw, "a", "rule1", "2026-01-01");
      expect(() => insertRecurring(raw, "b", "rule1", "2026-01-01")).toThrow(
        /UNIQUE/,
      );
    });

    it("allows a new occurrence after the first is soft-deleted", () => {
      const raw = migrated();
      insertRecurring(raw, "a", "rule1", "2026-01-01");
      raw.prepare("UPDATE receipts SET deleted_at = 5 WHERE id = 'a'").run();
      expect(() =>
        insertRecurring(raw, "b", "rule1", "2026-01-01"),
      ).not.toThrow();
    });

    it("does not constrain receipts without a rule", () => {
      const raw = migrated();
      insertRecurring(raw, "a", null, null);
      expect(() => insertRecurring(raw, "b", null, null)).not.toThrow();
    });
  });
});
