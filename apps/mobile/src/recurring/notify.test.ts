import { testDb } from "@/db/testing/testDb";
import type { NewRecurringRuleInput } from "@/db/types";
import { i18n, initI18n } from "@/i18n";

import { ensurePermissionForDraftRule, rescheduleAll, type LocalScheduler } from "./notify";
import { createRule, setPaused, softDeleteRule } from "./rules";

const TZ = "Asia/Jakarta";
/** Noon in Jakarta on 2026-03-10. */
const NOW = new Date("2026-03-10T05:00:00Z");

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
    anchorDate: "2026-01-15",
    monthDay: 15,
    tz: TZ,
    autoAdd: false,
    endDate: null,
    ...over,
  };
}

type Scheduled = Parameters<LocalScheduler["schedule"]>[0];

function fake(permission: "granted" | "denied" | "undetermined" = "granted") {
  const scheduled: Scheduled[] = [];
  const s = {
    scheduled,
    cancelAll: jest.fn(async () => {
      scheduled.length = 0;
    }),
    schedule: jest.fn(async (n: Scheduled) => {
      scheduled.push(n);
    }),
    permission: jest.fn(async () => permission),
    request: jest.fn(async () => "granted" as const),
  };
  return s;
}

beforeAll(() => initI18n("en"));

describe("rescheduleAll", () => {
  it("schedules one 09:00 notification per draft rule on its next occurrence", async () => {
    const db = testDb();
    const rule = createRule(db, ruleInput(), NOW);
    const s = fake();
    expect(await rescheduleAll(db, s, NOW)).toBe(1);
    expect(s.cancelAll).toHaveBeenCalledWith("recurring");
    expect(s.scheduled).toEqual([
      {
        id: `recurring-${rule.id}`,
        title: "Netflix is due",
        body: i18n.t("recurring.notifyBody"),
        at: { year: 2026, month: 3, day: 15, hour: 9, minute: 0 },
        data: { ruleId: rule.id, date: "2026-03-15" },
      },
    ]);
  });

  it("skips auto-add, paused, deleted and finished rules", async () => {
    const db = testDb();
    createRule(db, ruleInput({ autoAdd: true }), NOW);
    const paused = createRule(db, ruleInput({ merchant: "Paused" }), NOW);
    setPaused(db, paused.id, true, NOW);
    const gone = createRule(db, ruleInput({ merchant: "Gone" }), NOW);
    softDeleteRule(db, gone.id);
    createRule(db, ruleInput({ merchant: "Ended", endDate: "2026-03-01" }), NOW);
    const s = fake();
    expect(await rescheduleAll(db, s, NOW)).toBe(0);
    expect(s.scheduled).toEqual([]);
  });

  it("body names no amount", async () => {
    const db = testDb();
    createRule(db, ruleInput({ totalMinor: 186000 }), NOW);
    const s = fake();
    await rescheduleAll(db, s, NOW);
    expect(s.scheduled[0]!.body).toBe(i18n.t("recurring.notifyBody", { merchant: "Netflix" }));
    expect(s.scheduled[0]!.body).not.toMatch(/\d/);
    expect(s.scheduled[0]!.title).not.toMatch(/186/);
  });

  it("uses a generic title for a rule without a merchant", async () => {
    const db = testDb();
    createRule(db, ruleInput({ merchant: null }), NOW);
    const s = fake();
    await rescheduleAll(db, s, NOW);
    expect(s.scheduled[0]!.title).toBe(i18n.t("recurring.notifyTitle", { merchant: i18n.t("recurring.notifyUnnamed") }));
  });

  it("schedules nothing and does not throw when permission is denied", async () => {
    const db = testDb();
    createRule(db, ruleInput(), NOW);
    const s = fake("denied");
    await expect(rescheduleAll(db, s, NOW)).resolves.toBe(0);
    expect(s.schedule).not.toHaveBeenCalled();
    expect(s.request).not.toHaveBeenCalled();
  });

  it("does not ask for permission when undetermined (only ensurePermissionForDraftRule asks)", async () => {
    const db = testDb();
    createRule(db, ruleInput(), NOW);
    const s = fake("undetermined");
    expect(await rescheduleAll(db, s, NOW)).toBe(0);
    expect(s.request).not.toHaveBeenCalled();
  });
});

describe("ensurePermissionForDraftRule", () => {
  it("requests only when undetermined", async () => {
    const s = fake("undetermined");
    expect(await ensurePermissionForDraftRule(s)).toBe(true);
    expect(s.request).toHaveBeenCalledTimes(1);
  });
  it("does not request when already granted or denied", async () => {
    const granted = fake("granted");
    expect(await ensurePermissionForDraftRule(granted)).toBe(true);
    expect(granted.request).not.toHaveBeenCalled();
    const denied = fake("denied");
    expect(await ensurePermissionForDraftRule(denied)).toBe(false);
    expect(denied.request).not.toHaveBeenCalled();
  });
  it("returns false when the request is declined", async () => {
    const s = fake("undetermined");
    s.request.mockResolvedValueOnce("denied" as never);
    expect(await ensurePermissionForDraftRule(s)).toBe(false);
  });
});
