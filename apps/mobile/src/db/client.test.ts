import type { SQLiteDatabase } from "expo-sqlite";

import { createPrefs } from "@/prefs/prefs";
import { MasterKeyCorruptError, type SecretStore } from "@/crypto/keys";

import {
  DbKeyMismatchError,
  DbNotEncryptedError,
  deleteDatabaseFiles,
  openDatabase,
  openWithStore,
  resetLocalData,
} from "./client";

// Native module; only the injected `open` is used in these tests.
jest.mock("expo-sqlite", () => ({}));

const KEY = "ab".repeat(32);
const WRONG_KEY_MESSAGE = "Error code 26: file is not a database";

function fakeOpen(opts: { readError?: Error; cipherVersion?: string | null; log: string[] }) {
  const db = {
    execSync: (sql: string) => {
      opts.log.push(sql);
    },
    getFirstSync: (sql: string) => {
      opts.log.push(sql);
      if (sql === "PRAGMA cipher_version") {
        const v = opts.cipherVersion === undefined ? "4.17.0 community" : opts.cipherVersion;
        return v === null ? null : { cipher_version: v };
      }
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

  it("returns a db; cipher_version check first, then PRAGMA key before any data access", () => {
    const log: string[] = [];
    const db = openDatabase({ keyHex: KEY, open: fakeOpen({ log }) });
    expect(db).toBeDefined();
    expect(log[0]).toBe("PRAGMA cipher_version");
    expect(log[1]).toBe(`PRAGMA key = "x'${KEY}'"`);
    expect(log[2]).toBe("SELECT count(*) FROM sqlite_master");
  });

  it.each([null, ""])("throws DbNotEncryptedError and closes when cipher_version is %j", (v) => {
    const log: string[] = [];
    const open = fakeOpen({ cipherVersion: v, log });
    expect(() => openDatabase({ keyHex: KEY, open })).toThrow(DbNotEncryptedError);
    expect(log).toContain("close");
    expect(log.some((l) => l.startsWith("PRAGMA key"))).toBe(false);
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

describe("deleteDatabaseFiles", () => {
  it("treats a database-not-found error as already deleted", () => {
    const del = jest.fn(() => {
      throw new Error("Database not found: meb.db");
    });
    expect(() => deleteDatabaseFiles("meb.db", del)).not.toThrow();
  });

  it("rethrows any other delete error", () => {
    const err = new Error("permission denied");
    expect(() =>
      deleteDatabaseFiles("meb.db", () => {
        throw err;
      }),
    ).toThrow(err);
  });
});

describe("reset flow", () => {
  function store(initial?: string): SecretStore & { data: Map<string, string> } {
    const data = new Map<string, string>();
    if (initial) data.set("meb.masterKey.v1", initial);
    return {
      data,
      get: async (k) => data.get(k) ?? null,
      set: async (k, v) => void data.set(k, v),
      delete: async (k) => void data.delete(k),
    };
  }

  it("corrupt key -> locked; after resetLocalData -> opens fresh", async () => {
    const s = store("garbage");
    const open = fakeOpen({ log: [] });
    await expect(openWithStore({ store: s, open })).rejects.toBeInstanceOf(MasterKeyCorruptError);

    const deleteFiles = jest.fn();
    await resetLocalData({ store: s, deleteFiles, wipePrefs: jest.fn() });
    expect(deleteFiles).toHaveBeenCalledTimes(1);

    await expect(openWithStore({ store: s, open })).resolves.toBeDefined();
    expect(s.data.get("meb.masterKey.v1")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("deletes files before the key, and keeps the key if file delete fails", async () => {
    const s = store("ab".repeat(32));
    const order: string[] = [];
    const sd = s.delete;
    s.delete = async (k) => {
      order.push("key");
      await sd(k);
    };
    await resetLocalData({
      store: s,
      deleteFiles: () => void order.push("files"),
      wipePrefs: () => void order.push("prefs"),
    });
    expect(order).toEqual(["files", "prefs", "key"]);

    const s3 = store("ef".repeat(32));
    const order3: string[] = [];
    const sd3 = s3.delete;
    s3.delete = async (k) => {
      order3.push("key");
      await sd3(k);
    };
    await resetLocalData({
      store: s3,
      deleteFiles: () => void order3.push("files"),
      wipeImages: () => void order3.push("images"),
      wipePrefs: () => void order3.push("prefs"),
    });
    expect(order3).toEqual(["files", "images", "prefs", "key"]);

    const s2 = store("cd".repeat(32));
    await expect(
      resetLocalData({
        store: s2,
        wipePrefs: jest.fn(),
        deleteFiles: () => {
          throw new Error("boom");
        },
      }),
    ).rejects.toThrow("boom");
    expect(s2.data.has("meb.masterKey.v1")).toBe(true);
  });

  it("wipes prefs on reset, and keeps the key if the prefs wipe fails", async () => {
    const kv = new Map<string, string>([["homeCurrency", '"IDR"']]);
    const prefs = createPrefs({
      getString: (k) => kv.get(k),
      set: (k, v) => void kv.set(k, v),
      delete: (k) => void kv.delete(k),
    });
    const s = store("ab".repeat(32));
    await resetLocalData({ store: s, deleteFiles: jest.fn(), wipePrefs: () => prefs.reset() });
    expect(prefs.get("homeCurrency")).toBeNull();
    expect(kv.size).toBe(0);
    expect(s.data.has("meb.masterKey.v1")).toBe(false);

    const s2 = store("cd".repeat(32));
    await expect(
      resetLocalData({
        store: s2,
        deleteFiles: jest.fn(),
        wipePrefs: () => {
          throw new Error("prefs boom");
        },
      }),
    ).rejects.toThrow("prefs boom");
    expect(s2.data.has("meb.masterKey.v1")).toBe(true);
  });
});
