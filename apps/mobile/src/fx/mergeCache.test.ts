import { createPrefs, type FxCache, type KV } from "@/prefs/prefs";

import { mergeFxCache } from "./mergeCache";

function memoryKv(): KV {
  const data = new Map<string, string>();
  return {
    getString: (k) => data.get(k),
    set: (k, v) => void data.set(k, v),
    delete: (k) => void data.delete(k),
  };
}

const cache = (over: Partial<FxCache>): FxCache => ({
  base: "idr",
  latestDate: null,
  fetchedAt: null,
  byDate: {},
  ...over,
});

describe("mergeFxCache", () => {
  it("keeps dates from both caches", () => {
    const m = mergeFxCache(
      cache({ byDate: { "2026-01-01": { usd: "1" } } }),
      cache({ byDate: { "2026-01-02": { usd: "2" } } }),
    );
    expect(Object.keys(m.byDate).sort()).toEqual(["2026-01-01", "2026-01-02"]);
  });

  it("update wins for the same date and code, keeps other codes", () => {
    const m = mergeFxCache(
      cache({ byDate: { "2026-01-01": { usd: "1", eur: "5" } } }),
      cache({ byDate: { "2026-01-01": { usd: "9" } } }),
    );
    expect(m.byDate["2026-01-01"]).toEqual({ usd: "9", eur: "5" });
  });

  it("returns update when base differs", () => {
    const update = cache({ base: "usd", byDate: { "2026-01-01": { idr: "1" } } });
    expect(mergeFxCache(cache({ byDate: { "2025-01-01": { usd: "1" } } }), update)).toBe(update);
  });

  it("unions missingDates and takes the newer latestDate/fetchedAt", () => {
    const m = mergeFxCache(
      cache({ latestDate: "2026-02-01", fetchedAt: 500, missingDates: { "2026-01-05": 1 } }),
      cache({ latestDate: "2026-01-20", fetchedAt: 900, missingDates: { "2026-01-06": 2 } }),
    );
    expect(m.latestDate).toBe("2026-02-01");
    expect(m.fetchedAt).toBe(900);
    expect(m.missingDates).toEqual({ "2026-01-05": 1, "2026-01-06": 2 });
  });

  it("handles null latestDate/fetchedAt", () => {
    const m = mergeFxCache(cache({}), cache({ latestDate: "2026-01-20", fetchedAt: 9 }));
    expect(m.latestDate).toBe("2026-01-20");
    expect(m.fetchedAt).toBe(9);
  });

  it("keeps a prune: old current dates beyond the cap are not resurrected", () => {
    const dates = (from: number, n: number) =>
      Object.fromEntries(Array.from({ length: n }, (_, i) => [`2025-${String(from + i).padStart(4, "0")}`, { usd: "1" }]));
    const current = cache({ byDate: dates(1, 120) });
    const update = cache({ byDate: dates(1001, 120) }); // pruned the old ones away
    const m = mergeFxCache(current, update);
    expect(Object.keys(m.byDate)).toHaveLength(120);
    expect(m.byDate["2025-0001"]).toBeUndefined();
    expect(m.byDate["2025-1001"]).toBeDefined();
  });

  it("a writer holding a stale read no longer drops dates a concurrent write added", () => {
    const prefs = createPrefs(memoryKv());
    prefs.set("fxTables", cache({ byDate: { "2026-01-01": { usd: "1" } } }));
    const stale = prefs.get("fxTables");
    // concurrent syncFx write
    prefs.set("fxTables", cache({ byDate: { "2026-01-01": { usd: "1" }, "2026-01-02": { usd: "2" } } }));
    // slow writer saves its own result derived from the stale read
    const mine = { ...stale, byDate: { ...stale.byDate, "2026-01-03": { usd: "3" } } };
    prefs.set("fxTables", mergeFxCache(prefs.get("fxTables"), mine));
    expect(Object.keys(prefs.get("fxTables").byDate).sort()).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
  });
});
