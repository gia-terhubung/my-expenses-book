import { createPrefs, type KV } from "./prefs";

function memoryKv(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getString: (k) => data.get(k),
    set: (k, v) => void data.set(k, v),
    delete: (k) => void data.delete(k),
  };
}

describe("createPrefs", () => {
  it("returns defaults when unset", () => {
    const p = createPrefs(memoryKv());
    expect(p.get("onboardingStep")).toBe("language");
    expect(p.get("lockTimeout")).toBe(60);
    expect(p.get("lockEnabled")).toBe(false);
    expect(p.get("homeCurrency")).toBeNull();
    expect(p.get("language")).toBeNull();
    expect(p.get("lastBackupAt")).toBeNull();
    expect(p.get("receiptsSinceBackup")).toBe(0);
    expect(p.get("taxYearStartMonth")).toBe(1);
  });
  it("round-trips values across instances on the same storage", () => {
    const kv = memoryKv();
    const p = createPrefs(kv);
    p.set("homeCurrency", "IDR");
    p.set("lockEnabled", true);
    p.set("lockTimeout", 300);
    p.set("lastBackupAt", 1_700_000_000_000);
    expect(p.get("homeCurrency")).toBe("IDR");
    const p2 = createPrefs(kv);
    expect(p2.get("lockEnabled")).toBe(true);
    expect(p2.get("lockTimeout")).toBe(300);
    expect(p2.get("lastBackupAt")).toBe(1_700_000_000_000);
  });
  it("setting null deletes the key", () => {
    const kv = memoryKv();
    const p = createPrefs(kv);
    p.set("homeCurrency", "IDR");
    p.set("homeCurrency", null);
    expect(p.get("homeCurrency")).toBeNull();
    expect(kv.data.size).toBe(0);
  });
  it("falls back to default on corrupt stored value", () => {
    const kv = memoryKv();
    kv.set("lockTimeout", "{not json");
    expect(createPrefs(kv).get("lockTimeout")).toBe(60);
  });
  it("subscribe fires on set for that key only, and unsubscribes", () => {
    const p = createPrefs(memoryKv());
    const a = jest.fn();
    const b = jest.fn();
    const off = p.subscribe("language", a);
    p.subscribe("lockEnabled", b);
    p.set("language", "id");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    off();
    p.set("language", "es");
    expect(a).toHaveBeenCalledTimes(1);
  });
});

describe("reset", () => {
  it("clears every pref to defaults and notifies subscribers", () => {
    const kv = memoryKv();
    const p = createPrefs(kv);
    p.set("homeCurrency", "IDR");
    p.set("onboardingStep", "done");
    const cb = jest.fn();
    p.subscribe("homeCurrency", cb);
    p.reset();
    expect(kv.data.size).toBe(0);
    expect(p.get("homeCurrency")).toBeNull();
    expect(p.get("onboardingStep")).toBe("language");
    expect(cb).toHaveBeenCalled();
  });
});
