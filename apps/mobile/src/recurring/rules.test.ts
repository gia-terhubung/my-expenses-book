import { createReceipt, getReceipt } from "@/db/repositories/receipts";
import { recurringRules } from "@/db/schema";
import { testDb } from "@/db/testing/testDb";
import type { NewRecurringRuleInput } from "@/db/types";
import type { FxCache } from "@/prefs/prefs";

import { runCatchUp } from "./catchUp";
import { createRule, createRuleFromReceipt, listRules, setPaused, softDeleteRule, updateRule } from "./rules";

const TZ = "Asia/Jakarta";
const fx: FxCache = { base: "", latestDate: null, fetchedAt: null, byDate: {} };
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

const catchUp = (db: ReturnType<typeof testDb>, date: string) =>
  runCatchUp(db, { now: at(date), home: "IDR", fx });

describe("rules repository", () => {
  it("createRule with an anchor in the past backfills nothing", () => {
    const db = testDb();
    const rule = createRule(db, ruleInput({ anchorDate: "2026-01-01" }), at("2026-11-20"));
    expect(rule.lastGeneratedDate).toBe("2026-11-20");
    expect(catchUp(db, "2026-11-20").createdIds).toEqual([]);
    expect(catchUp(db, "2026-12-01").createdIds).toHaveLength(1);
  });

  it("createRule anchored today on a matching day creates today's occurrence on the next catch-up", () => {
    const db = testDb();
    const rule = createRule(db, ruleInput({ anchorDate: "2026-11-20", monthDay: 20 }), at("2026-11-20"));
    expect(rule.lastGeneratedDate).toBeNull();
    const res = catchUp(db, "2026-11-20");
    expect(res.createdIds).toHaveLength(1);
    expect(getReceipt(db, res.createdIds[0])?.recurringDate).toBe("2026-11-20");
    expect(catchUp(db, "2026-11-20").createdIds).toEqual([]);
  });

  it("createRule anchored yesterday creates nothing until the next due date", () => {
    const db = testDb();
    const rule = createRule(db, ruleInput({ anchorDate: "2026-11-19", monthDay: 19 }), at("2026-11-20"));
    expect(rule.lastGeneratedDate).toBe("2026-11-20");
    expect(catchUp(db, "2026-11-20").createdIds).toEqual([]);
    expect(catchUp(db, "2026-12-19").createdIds).toHaveLength(1);
  });

  it("createRule with a future anchor creates that first occurrence when it is due", () => {
    const db = testDb();
    const rule = createRule(db, ruleInput({ anchorDate: "2026-12-01" }), at("2026-11-20"));
    expect(rule.lastGeneratedDate).toBeNull();
    expect(catchUp(db, "2026-11-30").createdIds).toEqual([]);
    expect(catchUp(db, "2026-12-01").createdIds).toHaveLength(1);
  });

  it("createRuleFromReceipt links the receipt and only creates the next occurrence", () => {
    const db = testDb();
    const receipt = createReceipt(db, {
      status: "confirmed",
      merchant: "Gym",
      purchasedAtLocal: "2026-11-20T08:15:00",
      purchasedTz: TZ,
      purchasedAtUtc: Date.parse("2026-11-20T01:15:00Z"),
      scannedAtUtc: Date.parse("2026-11-20T01:15:00Z"),
      scannedTz: TZ,
      currency: "IDR",
      totalMinor: 300000,
      parseSource: "manual",
    });
    const rule = createRuleFromReceipt(
      db,
      receipt.id,
      ruleInput({ merchant: "Gym", totalMinor: 300000, anchorDate: "2026-11-20", monthDay: 20 }),
      at("2026-11-20"),
    );
    expect(getReceipt(db, receipt.id)).toMatchObject({ recurringRuleId: rule.id, recurringDate: "2026-11-20" });
    expect(rule.lastGeneratedDate).toBe("2026-11-20");
    expect(catchUp(db, "2026-11-20").createdIds).toEqual([]);
    const dec = catchUp(db, "2026-12-20");
    expect(dec.createdIds).toHaveLength(1);
    expect(getReceipt(db, dec.createdIds[0])?.recurringDate).toBe("2026-12-20");
  });

  it("createRuleFromReceipt keeps a later receipt date as lastGeneratedDate", () => {
    const db = testDb();
    const receipt = createReceipt(db, {
      status: "confirmed",
      merchant: "Rent",
      purchasedAtLocal: "2026-11-25T09:00:00",
      purchasedTz: TZ,
      purchasedAtUtc: Date.parse("2026-11-25T02:00:00Z"),
      scannedAtUtc: Date.parse("2026-11-20T02:00:00Z"),
      scannedTz: TZ,
      currency: "IDR",
      totalMinor: 1,
      parseSource: "manual",
    });
    const rule = createRuleFromReceipt(
      db,
      receipt.id,
      ruleInput({ anchorDate: "2026-11-25", monthDay: 25 }),
      at("2026-11-20"),
    );
    expect(rule.lastGeneratedDate).toBe("2026-11-25");
    expect(catchUp(db, "2026-11-25").createdIds).toEqual([]);
  });

  it("createRuleFromReceipt with a missing receipt throws and leaves no rule behind", () => {
    const db = testDb();
    expect(() => createRuleFromReceipt(db, "nope", ruleInput(), at("2026-11-20"))).toThrow();
    expect(listRules(db)).toEqual([]);
  });

  it("updateRule changing day 1 to 5 after the 1st was created creates nothing the same day", () => {
    const db = testDb();
    const rule = createRule(db, ruleInput(), at("2026-10-20"));
    expect(catchUp(db, "2026-11-01").createdIds).toHaveLength(1);
    const updated = updateRule(db, rule.id, { monthDay: 5 }, at("2026-11-10"));
    expect(updated.monthDay).toBe(5);
    expect(updated.lastGeneratedDate).toBe("2026-11-10");
    expect(updated.version).toBe(rule.version + 2);
    expect(catchUp(db, "2026-11-10").createdIds).toEqual([]);
    expect(catchUp(db, "2026-12-05").createdIds).toHaveLength(1);
  });

  it("setPaused then resume three months later creates nothing for the paused months", () => {
    const db = testDb();
    const rule = createRule(db, ruleInput(), at("2026-08-20"));
    setPaused(db, rule.id, true, at("2026-08-20"));
    expect(catchUp(db, "2026-10-15").createdIds).toEqual([]);
    setPaused(db, rule.id, false, at("2026-11-20"));
    expect(listRules(db)[0]).toMatchObject({ paused: false, lastGeneratedDate: "2026-11-20" });
    expect(catchUp(db, "2026-11-20").createdIds).toEqual([]);
    expect(catchUp(db, "2026-12-01").createdIds).toHaveLength(1);
  });

  it("softDeleteRule hides the rule and keeps the receipts it created", () => {
    const db = testDb();
    const rule = createRule(db, ruleInput(), at("2026-10-20"));
    const { createdIds } = catchUp(db, "2026-11-01");
    softDeleteRule(db, rule.id);
    expect(listRules(db)).toEqual([]);
    expect(getReceipt(db, createdIds[0])).toMatchObject({ recurringRuleId: rule.id });
    expect(catchUp(db, "2026-12-01").createdIds).toEqual([]);
  });

  it("listRules orders live rules by next due date", () => {
    const db = testDb();
    const now = at("2026-11-20");
    const late = createRule(db, ruleInput({ merchant: "Late", monthDay: 15 }), now);
    const soon = createRule(db, ruleInput({ merchant: "Soon", monthDay: 1 }), now);
    const weekly = createRule(
      db,
      ruleInput({ merchant: "Weekly", frequency: "weekly", anchorDate: "2026-11-23", monthDay: null }),
      now,
    );
    const ended = createRule(db, ruleInput({ merchant: "Ended", endDate: "2026-11-30" }), now);
    const gone = createRule(db, ruleInput({ merchant: "Gone" }), now);
    softDeleteRule(db, gone.id);
    expect(listRules(db).map((r) => r.id)).toEqual([weekly.id, soon.id, late.id, ended.id]);
    // Sanity: the stored rows still include the deleted one.
    expect(db.select().from(recurringRules).all()).toHaveLength(5);
  });
});
