import { createReceipt, getReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import { createPrefs, type KV } from "@/prefs/prefs";

import { rateUrl } from "./rates";
import { reconvertAll } from "./reconvert";
import { syncFx } from "./syncFx";

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 5);

function setup() {
  const m = new Map<string, string>();
  const kv: KV = {
    getString: (k) => m.get(k),
    set: (k, v) => void m.set(k, v),
    delete: (k) => void m.delete(k),
  };
  const prefs = createPrefs(kv);
  const db = testDb();
  return { prefs, db };
}
const rcpt = (over = {}) => ({
  merchant: "S",
  purchasedAtLocal: "2026-11-01T10:00:00",
  purchasedTz: "Asia/Jakarta",
  purchasedAtUtc: 1,
  scannedAtUtc: 1,
  scannedTz: "Asia/Jakarta",
  currency: "USD",
  totalMinor: 1234,
  parseSource: "heuristic" as const,
  ...over,
});
function online(bodies: Record<string, unknown>) {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(url);
    const b = bodies[url];
    return b === undefined
      ? { ok: false, status: 404, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => b };
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe("syncFx", () => {
  it("offline: one fetch, receipts and cache untouched", async () => {
    const { prefs, db } = setup();
    const r = createReceipt(db, rcpt());
    for (let i = 0; i < 5; i++) createReceipt(db, rcpt({ purchasedAtLocal: `2026-10-0${i + 1}T10:00:00` }));
    const calls: string[] = [];
    const fn = (async (u: string) => {
      calls.push(u);
      throw new Error("offline");
    }) as unknown as typeof fetch;
    await syncFx({ db, prefs, home: "IDR", now, fetchFn: fn });
    expect(calls).toHaveLength(1);
    expect(prefs.get("fxTables").byDate).toEqual({});
    expect(getReceipt(db, r.id)?.version).toBe(1); // cache base never set: no reconvert
  });

  it("first sync fetches latest + receipt date and converts", async () => {
    const { prefs, db } = setup();
    const r = createReceipt(db, rcpt());
    const { fn } = online({
      [rateUrl("IDR", "latest")]: { date: "2026-11-04", idr: { usd: 0.00005 } },
      [rateUrl("IDR", "2026-11-01")]: { date: "2026-11-01", idr: { usd: 0.00004 } },
    });
    await syncFx({ db, prefs, home: "IDR", now, fetchFn: fn });
    expect(getReceipt(db, r.id)).toMatchObject({ fxRate: "25000", amountHomeMinor: 30850000, fxRateDate: "2026-11-01" });
  });

  it("stale weekly refresh fetches latest again", async () => {
    const { prefs, db } = setup();
    prefs.set("fxTables", { base: "idr", latestDate: "2026-10-20", fetchedAt: now - 8 * DAY, byDate: { "2026-10-20": { usd: "0.00005" } } });
    const { fn, calls } = online({ [rateUrl("IDR", "latest")]: { date: "2026-11-05", idr: { usd: 0.00005 } } });
    await syncFx({ db, prefs, home: "IDR", now, fetchFn: fn });
    expect(calls).toEqual([rateUrl("IDR", "latest")]);
    expect(prefs.get("fxTables").fetchedAt).toBe(now);
  });

  it("fresh cache + converted receipts: no fetch, no writes", async () => {
    const { prefs, db } = setup();
    prefs.set("fxTables", { base: "idr", latestDate: "2026-11-01", fetchedAt: now - DAY, byDate: { "2026-11-01": { usd: "0.00005" } } });
    const r = createReceipt(db, rcpt());
    const { fn, calls } = online({});
    await syncFx({ db, prefs, home: "IDR", now, fetchFn: fn });
    const v = getReceipt(db, r.id)!;
    await syncFx({ db, prefs, home: "IDR", now, fetchFn: fn });
    expect(calls).toEqual([]);
    expect(getReceipt(db, r.id)).toEqual(v);
  });

  it("home currency change re-bases and reconverts", async () => {
    const { prefs, db } = setup();
    prefs.set("fxTables", { base: "idr", latestDate: "2026-11-01", fetchedAt: now - DAY, byDate: { "2026-11-01": { usd: "0.00005" } } });
    const r = createReceipt(db, rcpt({ homeCurrencyAtSave: "IDR" }));
    const { fn } = online({
      [rateUrl("EUR", "latest")]: { date: "2026-11-05", eur: { usd: 1.25 } },
      [rateUrl("EUR", "2026-11-01")]: { date: "2026-11-01", eur: { usd: 1.25 } },
    });
    await syncFx({ db, prefs, home: "EUR", now, fetchFn: fn });
    expect(prefs.get("fxTables").base).toBe("eur");
    expect(getReceipt(db, r.id)).toMatchObject({ homeCurrencyAtSave: "EUR", fxRate: "0.8", amountHomeMinor: 987 });
  });

  it("home change while offline leaves receipts alone", async () => {
    const { prefs, db } = setup();
    prefs.set("fxTables", { base: "idr", latestDate: "2026-11-01", fetchedAt: now - DAY, byDate: { "2026-11-01": { usd: "0.00005" } } });
    const r = createReceipt(db, rcpt({ homeCurrencyAtSave: "IDR", fxRate: "20000", amountHomeMinor: 24680000 }));
    const fn = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    await syncFx({ db, prefs, home: "EUR", now, fetchFn: fn });
    expect(getReceipt(db, r.id)).toMatchObject({ homeCurrencyAtSave: "IDR", amountHomeMinor: 24680000 });
  });

  it("old receipts get converted over successive passes (30 dates per pass) after a home change", async () => {
    const { prefs, db } = setup();
    prefs.set("fxTables", { base: "idr", latestDate: "2026-11-01", fetchedAt: now - DAY, byDate: { "2026-11-01": { usd: "0.00005" } } });
    const ids: string[] = [];
    const bodies: Record<string, unknown> = { [rateUrl("EUR", "latest")]: { date: "2026-11-05", eur: { usd: 1.25 } } };
    for (let i = 0; i < 31; i++) {
      const d = isoDay(Date.UTC(2026, 8, 1) + i * DAY);
      bodies[rateUrl("EUR", d)] = { date: d, eur: { usd: 1.25 } };
      ids.push(createReceipt(db, rcpt({ purchasedAtLocal: `${d}T10:00:00`, homeCurrencyAtSave: "IDR", fxRate: "20000", amountHomeMinor: 24680000 })).id);
    }
    const { fn, calls } = online(bodies);
    await syncFx({ db, prefs, home: "EUR", now, fetchFn: fn });
    expect(calls).toHaveLength(31); // latest + 30 newest dates
    const converted = () => ids.filter((id) => getReceipt(db, id)?.fxRateDate !== null && getReceipt(db, id)?.homeCurrencyAtSave === "EUR" && !getReceipt(db, id)?.fxApproximate);
    expect(converted()).toHaveLength(30);
    calls.length = 0;
    await syncFx({ db, prefs, home: "EUR", now, fetchFn: fn });
    expect(calls).toEqual([rateUrl("EUR", "2026-09-01")]);
    expect(converted()).toHaveLength(31);
    for (const id of ids) expect(getReceipt(db, id)).toMatchObject({ amountHomeMinor: 987, fxRate: "0.8" });
    calls.length = 0;
    await syncFx({ db, prefs, home: "EUR", now, fetchFn: fn });
    expect(calls).toEqual([]); // converged: nothing left to fetch
  });

  it("pruning old dates never nulls receipts already converted with them", async () => {
    const { prefs, db } = setup();
    const byDate: Record<string, Record<string, string>> = { "2026-01-01": { usd: "0.00005" } };
    for (let i = 0; i < 119; i++) byDate[isoDay(Date.UTC(2026, 3, 1) + i * DAY)] = { usd: "0.00004" };
    prefs.set("fxTables", { base: "idr", latestDate: "2026-07-28", fetchedAt: now - 8 * DAY, byDate });
    const old = createReceipt(db, rcpt({ purchasedAtLocal: "2026-01-01T10:00:00" }));
    reconvertAll(db, "IDR", prefs.get("fxTables"));
    const before = getReceipt(db, old.id)!;
    expect(before).toMatchObject({ amountHomeMinor: 24680000, fxRateDate: "2026-01-01" });
    // Stale weekly refresh adds a 121st date; the oldest (2026-01-01) is pruned.
    const { fn } = online({ [rateUrl("IDR", "latest")]: { date: "2026-11-05", idr: { usd: 0.00005 } } });
    await syncFx({ db, prefs, home: "IDR", now, fetchFn: fn });
    expect(prefs.get("fxTables").byDate["2026-01-01"]).toBeUndefined();
    expect(getReceipt(db, old.id)).toEqual(before);
  });

  it("a date older than 120 cached tables is fetched, kept through prune, and converts its receipt", async () => {
    const { prefs, db } = setup();
    const byDate: Record<string, Record<string, string>> = {};
    for (let i = 0; i < 120; i++) byDate[isoDay(Date.UTC(2026, 3, 1) + i * DAY)] = { eur: "0.00006" };
    prefs.set("fxTables", { base: "idr", latestDate: "2026-07-29", fetchedAt: now - DAY, byDate });
    const old = createReceipt(db, rcpt({ purchasedAtLocal: "2026-01-01T10:00:00" }));
    const { fn, calls } = online({ [rateUrl("IDR", "2026-01-01")]: { date: "2026-01-01", idr: { usd: 0.00005 } } });
    await syncFx({ db, prefs, home: "IDR", now, fetchFn: fn });
    expect(calls).toEqual([rateUrl("IDR", "2026-01-01")]);
    expect(getReceipt(db, old.id)).toMatchObject({ amountHomeMinor: 24680000, fxRateDate: "2026-01-01", fxApproximate: false });
  });
});

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
