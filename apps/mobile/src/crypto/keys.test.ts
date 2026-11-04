import {
  deriveKey,
  getOrCreateMasterKey,
  MasterKeyCorruptError,
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
  };
}

describe("getOrCreateMasterKey", () => {
  it("creates 32 bytes, stores 64 hex chars under mrb.masterKey.v1", async () => {
    const store = memoryStore();
    const key = await getOrCreateMasterKey(store);
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
    const stored = store.data.get("mrb.masterKey.v1");
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
    store.data.set("mrb.masterKey.v1", "garbage");
    await expect(getOrCreateMasterKey(store)).rejects.toBeInstanceOf(MasterKeyCorruptError);
    expect(store.data.get("mrb.masterKey.v1")).toBe("garbage");
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
  // "mrb-<purpose>-v1") across crypto implementations. Recompute if info strings change.
  it("matches pinned known answers", () => {
    expect(toHex(deriveKey(master, "db"))).toBe(
      "536fff079a95fbec4366bae52ee637aac02fefca3b3f2fcd3ddf15e90e02259d",
    );
    expect(toHex(deriveKey(master, "prefs"))).toBe("747118e646f253c9cfad94804faad278");
  });
});
