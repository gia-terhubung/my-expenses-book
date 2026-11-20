import { eq } from "drizzle-orm";

import { localToUtc } from "@/capture/localTime";
import { subscribeDataChanged } from "@/db/changes";
import { createReceipt, getReceipt, listDraftIds, updateReceipt } from "@/db/repositories/receipts";
import { receipts, recurringRules } from "@/db/schema";
import { testDb } from "@/db/testing/testDb";
import type { AppDb, NewRecurringRuleInput } from "@/db/types";
import { convertToHome } from "@/fx/convert";
import type { FxCache } from "@/prefs/prefs";

import { runCatchUp, undoCatchUp } from "./catchUp";
import { createRule } from "./rules";

const TZ = "Asia/Jakarta";
const noFx: FxCache = { base: "", latestDate: null, fetchedAt: null, byDate: {} };
/** Noon in Jakarta (UTC+7) on `date`. */
const at = (date: string) => new Date(`${date}T05:00:00Z`);

function ruleInput(over: Partial<NewRecurringRuleInput> = {}): NewRecurringRuleInput {
  return {
    merchant: "Netflix",
    currency: "IDR",
    totalMinor: 186000,
    taxMinor: null,
    categoryId: null,
    folderId: null,
    notes: null,
    frequency: "monthly",
    anchorDate: "2026-01-01",
    monthDay: 1,
    tz: TZ,
    autoAdd: true,
    endDate: null,
    ...over,
  };
}

/** A rule last generated on `last` (as if created earlier and caught up to that day). */
function ruleSince(db: AppDb, last: string, over: Partial<NewRecurringRuleInput> = {}) {
  const rule = createRule(db, ruleInput(over), at("2026-01-01"));
  db.update(recurringRules).set({ lastGeneratedDate: last }).where(eq(recurringRules.id, rule.id)).run();
  return rule;
}

const liveRecurring = (db: AppDb) =>
  db
    .select()
    .from(receipts)
    .all()
    .filter((r) => r.recurringRuleId !== null && r.deletedAt === null);

describe("runCatchUp", () => {
  it("creates one row per missed occurrence at 09:00 in the rule's zone", () => {
    const db = testDb();
    const rule = ruleSince(db, "2026-08-01");
    const res = runCatchUp(db, { now: at("2026-11-20"), home: "IDR", fx: noFx });
    expect(res.createdIds).toHaveLength(3);
    expect(res.draftCount).toBe(0);
    const rows = res.createdIds.map((id) => getReceipt(db, id)!);
    expect(rows.map((r) => r.purchasedAtLocal)).toEqual([
      "2026-09-01T09:00:00",
      "2026-10-01T09:00:00",
      "2026-11-01T09:00:00",
    ]);
    for (const r of rows) {
      expect(r).toMatchObject({
        purchasedTz: TZ,
        purchasedAtUtc: localToUtc(r.purchasedAtLocal, TZ),
        recurringRuleId: rule.id,
        recurringDate: r.purchasedAtLocal.slice(0, 10),
        merchant: "Netflix",
        currency: "IDR",
        totalMinor: 186000,
        status: "confirmed",
        parseSource: "manual",
        amountHomeMinor: 186000,
        homeCurrencyAtSave: "IDR",
      });
    }
    expect(db.select().from(recurringRules).get()?.lastGeneratedDate).toBe("2026-11-01");
  });

  it("converts a foreign rule with the given cache at the occurrence date", () => {
    const db = testDb();
    ruleSince(db, "2026-10-01", { currency: "USD", totalMinor: 1599 });
    const fx: FxCache = {
      base: "idr",
      latestDate: "2026-11-01",
      fetchedAt: 0,
      byDate: { "2026-11-01": { usd: "0.00006" }, "2026-10-15": { usd: "0.00005" } },
    };
    const res = runCatchUp(db, { now: at("2026-11-20"), home: "IDR", fx });
    const expected = convertToHome(1599, "USD", "IDR", "2026-11-01", fx)!;
    expect(getReceipt(db, res.createdIds[0])).toMatchObject({
      amountHomeMinor: expected.amountHomeMinor,
      fxRate: expected.fxRate,
      fxRateDate: "2026-11-01",
      fxApproximate: false,
      homeCurrencyAtSave: "IDR",
    });
  });

  it("leaves amountHomeMinor null when no rate exists, for syncFx to back-fill", () => {
    const db = testDb();
    ruleSince(db, "2026-10-01", { currency: "USD", totalMinor: 1599 });
    const res = runCatchUp(db, { now: at("2026-11-20"), home: "IDR", fx: noFx });
    expect(getReceipt(db, res.createdIds[0])).toMatchObject({
      amountHomeMinor: null,
      fxRate: null,
      fxRateDate: null,
      homeCurrencyAtSave: null,
    });
  });

  it("creates drafts for rules that do not add automatically and counts them", () => {
    const db = testDb();
    ruleSince(db, "2026-09-01", { autoAdd: false, merchant: "Electricity" });
    ruleSince(db, "2026-10-01", { autoAdd: true });
    const res = runCatchUp(db, { now: at("2026-11-20"), home: "IDR", fx: noFx });
    expect(res.createdIds).toHaveLength(3);
    expect(res.draftCount).toBe(2);
    expect(listDraftIds(db)).toHaveLength(2);
  });

  it("running twice in a row creates N rows, not 2N", () => {
    const db = testDb();
    ruleSince(db, "2026-08-01");
    const first = runCatchUp(db, { now: at("2026-11-20"), home: "IDR", fx: noFx });
    const second = runCatchUp(db, { now: at("2026-11-20"), home: "IDR", fx: noFx });
    expect(first.createdIds).toHaveLength(3);
    expect(second).toEqual({ createdIds: [], draftCount: 0 });
    expect(liveRecurring(db)).toHaveLength(3);
  });

  it("skips an occurrence that already has a live row without throwing", () => {
    const db = testDb();
    const rule = ruleSince(db, "2026-09-01");
    const existing = createReceipt(db, {
      status: "confirmed",
      merchant: "Netflix",
      purchasedAtLocal: "2026-10-01T09:00:00",
      purchasedTz: TZ,
      purchasedAtUtc: localToUtc("2026-10-01T09:00:00", TZ),
      scannedAtUtc: 0,
      currency: "IDR",
      totalMinor: 186000,
      parseSource: "manual",
      recurringRuleId: rule.id,
      recurringDate: "2026-10-01",
    });
    let res: ReturnType<typeof runCatchUp> | undefined;
    expect(() => {
      res = runCatchUp(db, { now: at("2026-11-20"), home: "IDR", fx: noFx });
    }).not.toThrow();
    expect(res!.createdIds).toHaveLength(1);
    expect(getReceipt(db, res!.createdIds[0])?.recurringDate).toBe("2026-11-01");
    expect(liveRecurring(db).map((r) => r.id).sort()).toEqual([existing.id, res!.createdIds[0]].sort());
    expect(db.select().from(recurringRules).get()?.lastGeneratedDate).toBe("2026-11-01");
  });

  it("ignores deleted rules", () => {
    const db = testDb();
    const rule = ruleSince(db, "2026-09-01");
    db.update(recurringRules).set({ deletedAt: 1 }).where(eq(recurringRules.id, rule.id)).run();
    expect(runCatchUp(db, { now: at("2026-11-20"), home: "IDR", fx: noFx }).createdIds).toEqual([]);
  });

  it("notifies data changed once when it creates rows, and not at all otherwise", () => {
    const db = testDb();
    ruleSince(db, "2026-08-01");
    const cb = jest.fn();
    const unsub = subscribeDataChanged(cb);
    runCatchUp(db, { now: at("2026-11-20"), home: "IDR", fx: noFx });
    expect(cb).toHaveBeenCalledTimes(1);
    runCatchUp(db, { now: at("2026-11-20"), home: "IDR", fx: noFx });
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
  });
});

describe("undoCatchUp", () => {
  it("soft-deletes exactly those rows and a second run does not recreate them", () => {
    const db = testDb();
    ruleSince(db, "2026-08-01");
    const other = createReceipt(db, {
      status: "confirmed",
      merchant: "Coffee",
      purchasedAtLocal: "2026-11-02T08:00:00",
      purchasedTz: TZ,
      purchasedAtUtc: localToUtc("2026-11-02T08:00:00", TZ),
      scannedAtUtc: 0,
      currency: "IDR",
      totalMinor: 30000,
      parseSource: "manual",
    });
    const res = runCatchUp(db, { now: at("2026-11-20"), home: "IDR", fx: noFx });
    expect(undoCatchUp(db, res.createdIds)).toBe(res.createdIds.length);
    for (const id of res.createdIds) expect(getReceipt(db, id)).toBeNull();
    expect(getReceipt(db, other.id)).not.toBeNull();
    expect(db.select().from(recurringRules).get()?.lastGeneratedDate).toBe("2026-11-01");
    expect(runCatchUp(db, { now: at("2026-11-20"), home: "IDR", fx: noFx }).createdIds).toEqual([]);
    expect(liveRecurring(db)).toHaveLength(0);
  });

  it("keeps rows the user edited after the run", () => {
    const db = testDb();
    ruleSince(db, "2026-08-01", { autoAdd: false });
    const res = runCatchUp(db, { now: at("2026-11-20"), home: "IDR", fx: noFx });
    const [edited, ...untouched] = res.createdIds;
    updateReceipt(db, edited, { status: "confirmed", totalMinor: 190000 });
    expect(undoCatchUp(db, res.createdIds)).toBe(untouched.length);
    expect(getReceipt(db, edited)).toMatchObject({ status: "confirmed", totalMinor: 190000 });
    for (const id of untouched) expect(getReceipt(db, id)).toBeNull();
  });
});
