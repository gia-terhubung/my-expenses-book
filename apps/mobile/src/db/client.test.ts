import type { SQLiteDatabase } from "expo-sqlite";

import { DbKeyMismatchError, openDatabase } from "./client";

// Native module; only the injected `open` is used in these tests.
jest.mock("expo-sqlite", () => ({}));

const KEY = "ab".repeat(32);
const WRONG_KEY_MESSAGE = "Error code 26: file is not a database";

function fakeOpen(opts: { readError?: Error; log: string[] }) {
  const db = {
    execSync: (sql: string) => {
      opts.log.push(sql);
    },
    getFirstSync: (sql: string) => {
      opts.log.push(sql);
      if (opts.readError) throw opts.readError;
      return { c: 0 };
    },
    closeSync: () => {
      opts.log.push("close");
    },
  };
  return () => db as unknown as SQLiteDatabase;
}

describe("openDatabase", () => {
  it("throws DbKeyMismatchError on the recorded wrong-key error and closes the handle", () => {
    const log: string[] = [];
    const open = fakeOpen({ readError: new Error(WRONG_KEY_MESSAGE), log });
    expect(() => openDatabase({ keyHex: KEY, open })).toThrow(DbKeyMismatchError);
    expect(log).toContain("close");
  });

  it("rethrows unrelated errors unchanged", () => {
    const err = new Error("disk I/O error");
    const open = fakeOpen({ readError: err, log: [] });
    expect(() => openDatabase({ keyHex: KEY, open })).toThrow(err);
  });

  it("returns a db; first statement is exactly PRAGMA key", () => {
    const log: string[] = [];
    const db = openDatabase({ keyHex: KEY, open: fakeOpen({ log }) });
    expect(db).toBeDefined();
    expect(log[0]).toBe(`PRAGMA key = "x'${KEY}'"`);
  });

  it("opens meb.db by default", () => {
    let opened = "";
    const inner = fakeOpen({ log: [] });
    openDatabase({
      keyHex: KEY,
      open: (name) => {
        opened = name;
        return inner();
      },
    });
    expect(opened).toBe("meb.db");
  });

  it("rejects a malformed key before touching the db", () => {
    const log: string[] = [];
    expect(() => openDatabase({ keyHex: "zz", open: fakeOpen({ log }) })).toThrow(/key/i);
    expect(log).toHaveLength(0);
  });
});
