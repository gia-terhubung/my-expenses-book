import type { KV } from "@/prefs/prefs";

import { createErrorLog, ERROR_LOG_KEY, MAX_ENTRIES, MAX_MESSAGE, MAX_STACK_LINES } from "./errorLog";
import { attachErrorLogStorage, errorLog, logError, resetErrorLogForTests } from "./instance";

function memoryKV(): KV & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getString: (k) => map.get(k), set: (k, v) => void map.set(k, v), delete: (k) => void map.delete(k) };
}

describe("createErrorLog", () => {
  it("lists newest first", () => {
    let t = 1000;
    const log = createErrorLog(memoryKV(), () => t++);
    log.append("a", new Error("first"));
    log.append("b", new Error("second"));
    expect(log.list().map((e) => e.message)).toEqual(["second", "first"]);
    expect(log.list()[0]).toMatchObject({ at: 1001, scope: "b" });
  });

  it("caps at MAX_ENTRIES and drops the oldest", () => {
    const log = createErrorLog(memoryKV());
    for (let i = 0; i <= MAX_ENTRIES; i++) log.append("s", new Error(`e${i}`));
    const list = log.list();
    expect(MAX_ENTRIES).toBe(200);
    expect(list).toHaveLength(200);
    expect(list[0].message).toBe("e200");
    expect(list.some((e) => e.message === "e0")).toBe(false);
  });

  it("truncates a huge message and a deep stack", () => {
    const log = createErrorLog(memoryKV());
    const e = new Error("x".repeat(1_000_000));
    e.stack = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    log.append("s", e);
    const [entry] = log.list();
    expect(MAX_MESSAGE).toBe(500);
    expect(entry.message).toHaveLength(500);
    expect(MAX_STACK_LINES).toBe(8);
    expect(entry.stack!.split("\n")).toHaveLength(8);
  });

  it("drops query params (receipt values) from drizzle errors, in message and stack", () => {
    const log = createErrorLog(memoryKV());
    const e = new Error('Failed query: insert into "receipts" ("merchant") values (?)\nparams: Toko Rahasia,12500');
    e.stack = `Error: ${e.message}\n    at run (bundle:1:2)`;
    log.append("render", e);
    const multi = new Error("Failed query: update x\nparams: line one note\nsecond line Toko Rahasia");
    multi.stack = `Error: ${multi.message}\n    at run (bundle:1:2)\n    at go (bundle:3:4)`;
    log.append("render", multi);
    const [m, entry] = log.list();
    expect(m.message).toBe("Failed query: update x");
    expect(m.stack).toBe("Error: Failed query: update x\n    at run (bundle:1:2)\n    at go (bundle:3:4)");
    expect(entry.message).toBe('Failed query: insert into "receipts" ("merchant") values (?)');
    expect(entry.stack).not.toContain("Toko Rahasia");
    expect(log.toText("1.0.0")).not.toContain("Toko Rahasia");
  });

  it("stores non-Error values by String()", () => {
    const log = createErrorLog(memoryKV());
    log.append("s", "boom");
    log.append("s", {});
    log.append("s", null);
    expect(log.list().map((e) => e.message)).toEqual(["null", "[object Object]", "boom"]);
    expect(log.list()[0].stack).toBeUndefined();
  });

  it("reads corrupt storage as empty and keeps working", () => {
    const kv = memoryKV();
    kv.set(ERROR_LOG_KEY, "{not json");
    const log = createErrorLog(kv);
    expect(log.list()).toEqual([]);
    log.append("s", new Error("ok"));
    expect(log.list()).toHaveLength(1);
  });

  it("never throws when storage fails", () => {
    const kv: KV = {
      getString: () => undefined,
      set: () => {
        throw new Error("disk full");
      },
      delete: () => {},
    };
    expect(() => createErrorLog(kv).append("s", new Error("x"))).not.toThrow();
  });

  it("clear empties the log", () => {
    const log = createErrorLog(memoryKV());
    log.append("s", new Error("x"));
    log.clear();
    expect(log.list()).toEqual([]);
  });

  it("toText starts with the app version and has one ISO-stamped block per entry", () => {
    const log = createErrorLog(memoryKV(), () => Date.UTC(2026, 10, 16, 8, 0, 0));
    log.append("render", new Error("one"));
    log.append("backup.postCommit", new Error("two"));
    const text = log.toText("1.0.0");
    expect(text.startsWith("My Expenses Book 1.0.0")).toBe(true);
    expect(text.match(/2026-11-16T08:00:00\.000Z/g)).toHaveLength(2);
    expect(text).toContain("[backup.postCommit] two");
  });
});

describe("instance", () => {
  beforeEach(() => resetErrorLogForTests());

  it("buffers errors before storage is attached, then keeps them", () => {
    logError("early", new Error("before unlock"));
    const kv = memoryKV();
    attachErrorLogStorage(kv);
    logError("late", new Error("after unlock"));
    expect(errorLog.list().map((e) => e.message)).toEqual(["after unlock", "before unlock"]);
    expect(kv.map.get(ERROR_LOG_KEY)).toContain("before unlock");
  });

  it("logError never throws", () => {
    attachErrorLogStorage({
      getString: () => {
        throw new Error("locked");
      },
      set: () => {},
      delete: () => {},
    });
    expect(() => logError("s", new Error("x"))).not.toThrow();
  });
});
