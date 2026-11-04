import { hkdfSync } from "crypto";
import {
  deriveKey,
  getOrCreateMasterKey,
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

  it("matches HKDF-SHA256 known answer", () => {
    const expected = Buffer.from(
      hkdfSync("sha256", master, Buffer.alloc(0), "mrb-db-v1", 32),
    ).toString("hex");
    expect(toHex(deriveKey(master, "db"))).toBe(expected);
  });
});
