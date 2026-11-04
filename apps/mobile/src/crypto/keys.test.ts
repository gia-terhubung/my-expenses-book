import {
  deriveKey,
  getOrCreateMasterKey,
  MasterKeyCorruptError,
  resetMasterKey,
  toHex,
  type SecretStore,
} from "./keys";

function memoryStore(): SecretStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => {
      data.set(k, v);
    },
    delete: async (k) => {
      data.delete(k);
    },
  };
}

describe("getOrCreateMasterKey", () => {
  it("creates 32 bytes, stores 64 hex chars under meb.masterKey.v1", async () => {
    const store = memoryStore();
    const key = await getOrCreateMasterKey(store);
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
    const stored = store.data.get("meb.masterKey.v1");
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).toBe(toHex(key));
  });

  it("returns identical bytes on second call", async () => {
    const store = memoryStore();
    const a = await getOrCreateMasterKey(store);
    const b = await getOrCreateMasterKey(store);
    expect(toHex(b)).toBe(toHex(a));
  });
});

describe("getOrCreateMasterKey hardening", () => {
  it("throws MasterKeyCorruptError and never overwrites a malformed value", async () => {
    const store = memoryStore();
    store.data.set("meb.masterKey.v1", "garbage");
    await expect(getOrCreateMasterKey(store)).rejects.toBeInstanceOf(MasterKeyCorruptError);
    expect(store.data.get("meb.masterKey.v1")).toBe("garbage");
  });

  it("concurrent first-run calls share one key and one set", async () => {
    const data = new Map<string, string>();
    const set = jest.fn(async (k: string, v: string) => {
      data.set(k, v);
    });
    const store: SecretStore = {
      get: async (k) => {
        const snapshot = data.get(k) ?? null; // read at call time, like a slow backend
        await new Promise((r) => setTimeout(r, 5));
        return snapshot;
      },
      set,
      delete: async (k) => void data.delete(k),
    };
    const [a, b] = await Promise.all([getOrCreateMasterKey(store), getOrCreateMasterKey(store)]);
    expect(toHex(a)).toBe(toHex(b));
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("allows retry after a failed attempt", async () => {
    const data = new Map<string, string>();
    let fail = true;
    const store: SecretStore = {
      get: async (k) => {
        if (fail) throw new Error("boom");
        return data.get(k) ?? null;
      },
      set: async (k, v) => {
        data.set(k, v);
      },
      delete: async (k) => void data.delete(k),
    };
    await expect(getOrCreateMasterKey(store)).rejects.toThrow("boom");
    fail = false;
    expect((await getOrCreateMasterKey(store)).length).toBe(32);
  });
});

describe("deriveKey", () => {
  const master = new Uint8Array(32).fill(1);

  it("is deterministic, 32 bytes", () => {
    const a = deriveKey(master, "db");
    expect(a.length).toBe(32);
    expect(toHex(deriveKey(master, "db"))).toBe(toHex(a));
  });

  it("differs per purpose", () => {
    expect(toHex(deriveKey(master, "db"))).not.toBe(toHex(deriveKey(master, "images")));
  });

  it("prefs key is 16 bytes", () => {
    expect(deriveKey(master, "prefs").length).toBe(16);
  });

  // Hardcoded vectors pin the derivation (HKDF-SHA256, empty salt, info
  // "meb-<purpose>-v1") across crypto implementations. Recompute if info strings change.
  it("matches pinned known answers", () => {
    expect(toHex(deriveKey(master, "db"))).toBe(
      "429433026431108dc544a154647b9032f8adfb7ad71011775daef6219c348a90",
    );
    expect(toHex(deriveKey(master, "prefs"))).toBe("316a78e93926a79ebd163bef76e43348");
  });
});

describe("resetMasterKey", () => {
  it("deletes the stored key so the next call creates a new one", async () => {
    const store = memoryStore();
    const first = toHex(await getOrCreateMasterKey(store));
    await resetMasterKey(store);
    expect(store.data.has("meb.masterKey.v1")).toBe(false);
    const second = toHex(await getOrCreateMasterKey(store));
    expect(second).not.toBe(first);
  });

  it("recovers from a corrupt stored key", async () => {
    const store = memoryStore();
    store.data.set("meb.masterKey.v1", "garbage");
    await expect(getOrCreateMasterKey(store)).rejects.toBeInstanceOf(MasterKeyCorruptError);
    await resetMasterKey(store);
    expect((await getOrCreateMasterKey(store)).length).toBe(32);
  });
});
