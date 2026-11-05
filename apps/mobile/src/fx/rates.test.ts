import type { FxCache } from "@/prefs/prefs";

import { ensureRates, fetchRates, rateUrl } from "./rates";

const DAY = 86_400_000;
const empty: FxCache = { base: "", latestDate: null, fetchedAt: null, byDate: {} };

function fakeFetch(bodies: Record<string, unknown>) {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(url);
    const body = bodies[url];
    if (body === undefined) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => body };
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe("rateUrl", () => {
  it("builds the jsDelivr url with lowercase base", () => {
    expect(rateUrl("IDR", "latest")).toBe(
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/idr.json",
    );
    expect(rateUrl("idr", "2026-11-04")).toBe(
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@2026-11-04/v1/currencies/idr.json",
    );
  });
});

describe("fetchRates", () => {
  it("parses the fixture and stringifies rates", async () => {
    const { fn } = fakeFetch({
      [rateUrl("IDR", "latest")]: { date: "2026-11-04", idr: { usd: 0.0000613, eur: 0.5 } },
    });
    const r = await fetchRates("IDR", "latest", fn);
    expect(r.date).toBe("2026-11-04");
    expect(r.rates).toEqual({ usd: String(0.0000613), eur: "0.5" });
  });

  it("throws on http error and on malformed body", async () => {
    const { fn } = fakeFetch({ [rateUrl("IDR", "latest")]: { date: "2026-11-04" } });
    await expect(fetchRates("IDR", "latest", fn)).rejects.toThrow();
    await expect(fetchRates("IDR", "2020-01-01", fn)).rejects.toThrow();
  });

  it("drops non-finite rates", async () => {
    const { fn } = fakeFetch({
      [rateUrl("IDR", "latest")]: { date: "2026-11-04", idr: { usd: 1, bad: "x", neg: -1 } },
    });
    expect((await fetchRates("IDR", "latest", fn)).rates).toEqual({ usd: "1" });
  });
});

describe("ensureRates", () => {
  const now = Date.UTC(2026, 10, 5);
  const fresh: FxCache = {
    base: "idr",
    latestDate: "2026-11-04",
    fetchedAt: now - DAY,
    byDate: { "2026-11-04": { usd: "0.00005" }, "2026-11-01": { usd: "0.00005" } },
  };

  it("skips fetch when fresh and date cached", async () => {
    const { fn, calls } = fakeFetch({});
    const out = await ensureRates(fresh, "IDR", "2026-11-01", now, fn);
    expect(calls).toEqual([]);
    expect(out).toBe(fresh);
  });

  it("refreshes latest when 8 days old", async () => {
    const { fn, calls } = fakeFetch({
      [rateUrl("IDR", "latest")]: { date: "2026-11-05", idr: { usd: 0.00006 } },
    });
    const out = await ensureRates({ ...fresh, fetchedAt: now - 8 * DAY }, "IDR", "2026-11-01", now, fn);
    expect(calls).toEqual([rateUrl("IDR", "latest")]);
    expect(out.fetchedAt).toBe(now);
    expect(out.latestDate).toBe("2026-11-05");
    expect(out.byDate["2026-11-05"]).toEqual({ usd: "0.00006" });
    expect(out.byDate["2026-11-01"]).toEqual({ usd: "0.00005" });
  });

  it("fetches a missing purchase date", async () => {
    const { fn, calls } = fakeFetch({
      [rateUrl("IDR", "2026-10-20")]: { date: "2026-10-20", idr: { usd: 0.00004 } },
    });
    const out = await ensureRates(fresh, "IDR", "2026-10-20", now, fn);
    expect(calls).toEqual([rateUrl("IDR", "2026-10-20")]);
    expect(out.byDate["2026-10-20"]).toEqual({ usd: "0.00004" });
  });

  it("returns cache unchanged when fetch throws", async () => {
    const throwing = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const stale = { ...fresh, fetchedAt: now - 8 * DAY };
    expect(await ensureRates(stale, "IDR", "2026-10-20", now, throwing)).toBe(stale);
    expect(await ensureRates(empty, "IDR", "2026-10-20", now, throwing)).toBe(empty);
  });

  it("starts a fresh table when the base changes", async () => {
    const { fn } = fakeFetch({
      [rateUrl("USD", "latest")]: { date: "2026-11-05", usd: { idr: 16000 } },
    });
    const out = await ensureRates(fresh, "USD", "latest", now, fn);
    expect(out.base).toBe("usd");
    expect(Object.keys(out.byDate)).toEqual(["2026-11-05"]);
  });

  it("keeps at most 120 dates, dropping the oldest", async () => {
    const byDate: FxCache["byDate"] = {};
    for (let i = 0; i < 120; i++) {
      byDate[new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)] = { usd: "1" };
    }
    const { fn } = fakeFetch({
      [rateUrl("IDR", "latest")]: { date: "2026-11-05", idr: { usd: 1 } },
    });
    const out = await ensureRates({ base: "idr", latestDate: null, fetchedAt: null, byDate }, "IDR", "2026-01-01", now, fn);
    const keys = Object.keys(out.byDate).sort();
    expect(keys).toHaveLength(120);
    expect(keys[0]).toBe("2026-01-02");
    expect(keys[119]).toBe("2026-11-05");
  });
});
