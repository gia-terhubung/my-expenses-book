# Recurring expenses, payday month, pre-upgrade snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add recurring expenses (with due-day notifications for draft-type rules), a payday-based month for Home and Stats, and an automatic database copy that is restored if a migration fails, all before the 1.0 launch.

**Architecture:** Pure date logic (`stats/payPeriod.ts`, `recurring/occurrences.ts`) is unit-tested in isolation. Recurring rules live in a new sync-ready `recurring_rules` table. A catch-up pass on unlock and on foreground turns due occurrences into ordinary `receipts` rows, linked by `recurring_rule_id` + `recurring_date` under a partial unique index. Migrations move from Drizzle's `useMigrations` hook to our own `safeMigrate`, which copies the encrypted DB file first.

**Tech Stack:** Expo SDK 58, expo-router, Drizzle ORM (expo-sqlite / SQLCipher; better-sqlite3 in Jest), MMKV prefs, zod, i18next (en, id, es, pt-BR), Jest + React Native Testing Library, new dependency `expo-notifications`.

**Spec:** `docs/superpowers/specs/2026-11-20-v1-recurring-payday-snapshot-design.md`

All paths below are relative to `apps/mobile/` unless they start with `docs/`.

## Global Constraints

- Every new table carries the sync base columns `id` (UUIDv7), `createdAt`, `updatedAt`, `deletedAt`, `version` (the `base` object in `src/db/schema.ts`).
- Date logic uses `YYYY-MM-DD` / `YYYY-MM` strings and integer arithmetic, no `Date` maths on local dates (house rule in `src/stats/stats.ts`). Use `formatLocal`, `localToUtc` and `deviceTimeZone` from `src/capture/localTime.ts` for zone conversions.
- No new network calls. Notifications are local only; never request a push token.
- Every user-facing string goes into all four locales (`src/i18n/locales/{en,id,es,pt-BR}.json`). `src/i18n/locales.test.ts` enforces key parity.
- `monthStartDay`: integer 1–28, default 1. With 1, every existing output must be unchanged.
- Recurring frequencies: `weekly` | `monthly` | `yearly`. `monthDay`: 1–28 or `-1` (= last day). A yearly rule anchored on 29 Feb falls on 28 Feb in non-leap years.
- Created occurrence time: `<date>T09:00:00` in the rule's `tz`. Notification time: 09:00 device local time. Notification body: merchant name only, never an amount.
- Pay-period label: start day ≤ 15 → the start month; start day > 15 → the end month.
- Search and export presets stay on calendar months.
- The pre-upgrade copy lives at `<db path>.pre-upgrade`; exactly one copy at a time.
- Commit after each task to `main` (owner works alone on `main`). Messages: Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Gates per task: `npx jest <touched tests>` green; at the end of each task `npm run typecheck` green and `npm run lint` with no new problems against the current baseline of 4 errors.

## Review Focus

1. **Travel across the date line during catch-up.** Rule in `Asia/Jakarta`, device in `Pacific/Kiritimati` (UTC+14) or `Pacific/Pago_Pago` (UTC−11): the occurrence is created exactly once, on the Jakarta date. Test in Task 5.
2. **Catch-up racing itself.** App start and foreground firing together must not create a row twice or fail. Test in Task 6: two `runCatchUp` calls in sequence on the same state create N rows total, and an insert hitting the partial unique index is skipped, not thrown.
3. **Restore while catch-up would run.** Catch-up must not run while `restoreLease` is held, and must run once when it frees. Test in Task 6.
4. **An old backup without `recurringRules`** (schema version ≤ 4) still restores in both modes. Test in Task 7.
5. **Low storage when copying the DB** before a migration: no migration runs, the app shows the free-space message, and the DB is untouched. Test in Task 3.

## UI and UX design (frontend-design pass)

The brief pins the visual direction: the approved **Ledger slip** system (`docs/superpowers/specs/2026-11-16-ledger-slip-redesign-design.md`, tokens in `src/theme/tokens.ts`) and the foldable rules (`docs/superpowers/specs/2026-11-17-foldable-readiness-design.md`). Follow them exactly. No new colours, fonts, shadows or radii.

- **Colour:** existing tokens only. Selected = tonal green fill; rows and cards = 1px green hairline; no grey drop shadows. Text contrast ≥ 4.5:1 in light and dark (`src/theme/contrast.test.ts` pattern).
- **Type:** the existing `type` scale. Amounts use the same figure style as receipt rows. Sentence case everywhere; no all-caps labels, no eyebrow labels, no middle-dot meta strings, no "→" on buttons.
- **The one loud element stays the Home slip.** Recurring screens are quiet. The only new distinctive device is the **day grid**: days 1–28 as a 7 × 4 grid, like a calendar page, plus a "Last day" chip. It is shared by the "Month starts on" sheet and the rule form's monthly day, so picking a day looks and works the same in both places.
- **Components:** existing `Button` (primary, secondary tonal, quiet, destructive), `Card`, `OptionRow`, `PickerSheet`, `FolderPicker`, `EmptyState`. Targets ≥ 48 dp (`size.touch`).
- **Motion:** none added beyond the existing press feedback; the catch-up banner appears without animation. Respect reduced motion.

Layout sketches (compact phone; medium and expanded use `TwoPane`):

```
Recurring (compact)                 Recurring (medium/expanded, Duo open, foldable inner)
┌─────────────────────────────┐     ┌──────┬──────────────────┬───────────────────────┐
│ ‹ Recurring           New   │     │ rail │ Recurring   New  │ Netflix               │
│ About Rp 412.000 a month    │     │      │ About Rp 412.000 │ Amount   Rp 186.000   │
│ ─────────────────────────── │     │      │ a month          │ Repeats  Monthly      │
│ Netflix            186.000  │     │      │ ──────────────── │ On day   [day grid]   │
│ Monthly · next 1 Dec        │ ✗   │      │ Netflix   186.000│ Add automatically  ●  │
│ Electricity     ~ 250.000   │     │      │ Monthly, next…   │ …                     │
│ Monthly, next 5 Dec · asks  │ ✗   │      │ Rent    3.500.000│ [ Save ]              │
└─────────────────────────────┘     └──────┴──────────────────┴───────────────────────┘
```

Row subtitle copy (no middle dots): "Monthly, next 1 Dec" and, for draft-type rules, "Monthly, next 5 Dec. Asks you to confirm." Draft-type amounts are prefixed "~" to show they're estimates.

Catch-up banner (Home, under the slip, above the list; a hairline `Card`):

```
┌─────────────────────────────────────────────┐
│ Added 3 recurring expenses.                 │
│ 2 need you to confirm the amount.           │
│ [ Review ]                          Undo    │
└─────────────────────────────────────────────┘
```

"Review" is a secondary button and opens the first draft; "Undo" is quiet and removes the rows that run added, then the banner reads "Removed 3 recurring expenses." for 4 seconds. When nothing needs confirming the second line is omitted and the button is hidden.

Day grid (sheet and form):

```
 1  2  3  4  5  6  7
 8  9 10 11 12 13 14
15 16 17 18 19 20 21
22 23 24 25 26 27 28
[ Last day ]            (rule form only; payday stops at 28)
```

Foldables and iPhone Duo (phase 1 rules from the foldable spec):
- Window classes from `src/layout/windowClass.ts`: compact < 600 dp, medium 600–839, expanded ≥ 840.
- Compact (phones, Duo closed and sideways, Z Flip cover, Split View): one pane; the list pushes the form.
- Medium and expanded (Duo open, Pixel Fold / Z Fold inner): `TwoPane`, list left, form right, so the form sits on the right leaf in book posture and never straddles the fold. The day grid fits a 280 dp pane (7 × 40 dp cells).
- Everything a person has open survives fold, unfold and rotation: typed form values, the selected rule, an open day sheet.
- The form's Save button is the last item in the scroll view, not pinned, so it never sits fixed on the tabletop crease.

---

### Task 1: Pay-period date functions

**Files:**
- Create: `src/stats/payPeriod.ts`, `src/stats/payPeriod.test.ts`
- Modify: `src/stats/stats.ts` (`pacePeriods`, `lastMonths`), `src/stats/stats.test.ts`

**Interfaces:**
- Produces:
  - `type PayPeriod = { from: string; to: string; label: string /* "YYYY-MM" */ }`
  - `payPeriodOf(localDate: string, startDay: number): PayPeriod`
  - `previousPayPeriod(p: PayPeriod, startDay: number): PayPeriod`
  - `lastPayPeriods(today: string, n: number, startDay: number): PayPeriod[]`, oldest first
  - `pacePeriods(today: string, startDay = 1): PacePeriods`. Same shape; `previousMonth` becomes the previous period's `label`.

- [ ] **Step 1: Write failing tests** in `payPeriod.test.ts`:
  - `payPeriodOf("2026-11-20", 1)` → `{ from: "2026-11-01", to: "2026-11-30", label: "2026-11" }`
  - `payPeriodOf("2026-11-20", 25)` → `{ from: "2026-10-25", to: "2026-11-24", label: "2026-11" }`
  - `payPeriodOf("2026-11-25", 25)` → `{ from: "2026-11-25", to: "2026-12-24", label: "2026-12" }`
  - `payPeriodOf("2026-11-20", 15)` → `{ from: "2026-11-15", to: "2026-12-14", label: "2026-11" }`
  - `payPeriodOf("2026-11-20", 16)` → `{ from: "2026-11-16", to: "2026-12-15", label: "2026-12" }`
  - Year boundary: `payPeriodOf("2027-01-03", 28)` → `{ from: "2026-12-28", to: "2027-01-27", label: "2027-01" }`
  - Leap year: `payPeriodOf("2028-02-28", 1).to === "2028-02-29"`
  - `lastPayPeriods("2026-11-20", 3, 25).map(p => p.label)` → `["2026-09", "2026-10", "2026-11"]`
- [ ] **Step 2:** Add to `stats.test.ts`: `pacePeriods("2026-11-20", 25)` → current `{ from: "2026-10-25", to: "2026-11-20" }`, previous `{ from: "2026-09-25", to: "2026-10-20" }`, `previousMonth: "2026-10"`. Every existing `pacePeriods(today)` test must stay unchanged and green.
- [ ] **Step 3: Run** `npx jest src/stats` → FAIL (module not found / wrong values).
- [ ] **Step 4: Implement** `payPeriod.ts` and the `startDay` parameter. Previous-period "same day offset": previous `from` + (today − current `from`) days, clamped to previous `to`.
- [ ] **Step 5: Run** `npx jest src/stats` → PASS.
- [ ] **Step 6: Commit** `feat(stats): pay-period date functions`.

### Task 2: "Month starts on" setting, used by Home and Stats

**Files:**
- Modify: `src/prefs/prefs.ts` (`Prefs.monthStartDay`, `PREF_DEFAULTS.monthStartDay = 1`), `src/app/(tabs)/settings.tsx`, `src/receipts/TotalsHeader.tsx`, `src/stats/StatsScreen.tsx`, `src/db/repositories/receiptQueries.ts`, all four locale files
- Create: `src/settings/MonthStartPicker.tsx` (or beside `TaxYearPicker`, following its pattern)
- Test: `src/prefs/prefs.test.ts`, `src/stats/StatsScreen.test.tsx`, `src/receipts/TotalsHeader` test (create `TotalsHeader.test.tsx` if absent), `src/app/(tabs)/settings` test if present

**Interfaces:**
- Consumes: Task 1 `payPeriodOf`, `lastPayPeriods`, `pacePeriods(today, startDay)`.
- Produces:
  - pref `monthStartDay: number`
  - `periodTotals(db: AppDb, periods: PayPeriod[], home: string): Record<string /* label */, HomeTotal>`, built from `sumHome` per period

- [ ] **Step 1: Write failing tests:**
  - `prefs.test`: default `monthStartDay` is `1`.
  - `StatsScreen.test`, with `monthStartDay = 25`, today `2026-11-20`, and receipts on `2026-10-24` (IDR 100) and `2026-10-26` (IDR 200):
    - the month total shows 200;
    - the subtitle "25 Oct – 24 Nov" is rendered;
    - the month bar labelled November includes the 26 Oct receipt.
  - With `monthStartDay = 1`, the existing snapshot and assertions are unchanged.
  - `TotalsHeader`: the same 25th case, "this month" shows 200.
  - Settings: a row "Month starts on" showing "Day 25" opens a picker of 1–28. Its helper text reads exactly: "Used by Home and Stats. Exports and search use calendar months."
  - The "Month starts on" sheet renders the day grid (`src/components/DayGrid.tsx`, created here, reused in Task 9): 28 cells, the selected day tonal, each cell ≥ 40 dp with a 48 dp hit area, `accessibilityLabel` "Day {{n}}".
- [ ] **Step 2: Run** those tests → FAIL.
- [ ] **Step 3: Implement.**
  - Home and Stats replace `${today.slice(0,7)}-01` / `-31` ranges with `payPeriodOf(today, startDay)`.
  - Stats month mode uses `lastPayPeriods(today, 6, startDay)` with `periodTotals` instead of `lastMonths` + `monthTotals`.
  - The range subtitle shows only when `startDay !== 1`. Format day and month with the existing locale month formatter.
  - Add i18n keys `settings.monthStart`, `settings.monthStartValue` ("Day {{n}}") and `settings.monthStartHelp` in all four locales.
- [ ] **Step 4: Run** `npx jest src/stats src/receipts src/prefs src/app src/i18n` → PASS.
- [ ] **Step 5: Commit** `feat(stats): month starts on payday for Home and Stats`.

### Task 3: Copy the DB before migrations; restore it on failure

**Files:**
- Create: `src/db/safeMigrate.ts`, `src/db/safeMigrate.test.ts`
- Modify: `src/db/DatabaseProvider.tsx` (replace `useMigrations` in `Migrated`), `src/db/client.ts` (export `dbFilePath(name = DB_NAME): string`), all four locale files

**Interfaces:**
- Produces:

```ts
export interface DbFileOps {
  exists(path: string): boolean;
  copy(from: string, to: string): void; // throws on failure (e.g. ENOSPC)
  remove(path: string): void;           // no-op if missing
}
export type MigrateOutcome =
  | { status: "ok" }
  | { status: "restored"; error: Error }   // migration failed, copy put back
  | { status: "noSpace"; error: Error };   // copy failed, nothing migrated
export async function safeMigrate(opts: {
  db: AppDb;
  dbPath: string;
  files: DbFileOps;
  pendingCount: (db: AppDb) => number;                 // journal entries minus rows in __drizzle_migrations (table may be missing → 0 applied)
  runMigrations: (db: AppDb) => Promise<void>;         // drizzle expo-sqlite `migrate(db, migrations)`
  reopen: () => AppDb;                                 // close + reopen after a restore
}): Promise<MigrateOutcome>;
```

- [ ] **Step 1: Write failing tests** with a fake `DbFileOps` (a Map of path → bytes) and a better-sqlite3 test DB:
  - `"no pending migrations: no copy, ok"`: `copy` is never called.
  - `"fresh install (0 applied): no copy, ok"`: no data exists yet, so nothing to protect.
  - `"pending + existing data: copies first, migrates, returns ok, keeps the copy"`: after the call, `<dbPath>.pre-upgrade` exists.
  - `"next launch with nothing pending removes a leftover copy"`.
  - `"migration throws: restores the copy, reopens, returns restored"`: the fake `runMigrations` throws, and the DB file bytes equal the pre-upgrade bytes.
  - `"copy throws: returns noSpace and runMigrations is never called"`.
- [ ] **Step 2: Run** `npx jest src/db/safeMigrate` → FAIL.
- [ ] **Step 3: Implement** `safeMigrate`.
  - Before copying, run `PRAGMA wal_checkpoint(TRUNCATE)` so the file is complete.
  - Device `DbFileOps` uses `expo-file-system` (`File`/`Paths` API already used in `src/images/expoFs.ts`).
  - `dbFilePath` = `SQLite.defaultDatabaseDirectory` + `/` + name.
- [ ] **Step 4: Wire `Migrated`** to call `safeMigrate` in an effect:
  - `restored` → `ErrorPanel` titled `dbError.migrationRestored`, scope `db.migrate`.
  - `noSpace` → `ErrorPanel` titled `dbError.noSpace`.
  - New copy (all locales):
    - `dbError.migrationRestored`: "The update couldn't upgrade your data. Your receipts are safe. Please update the app again or contact support."
    - `dbError.noSpace`: "Not enough free space to update your data safely. Free up some space and open the app again."
- [ ] **Step 5: Run** `npx jest src/db` → PASS. The existing `DatabaseProvider.test.tsx` must still pass; update its mock from `useMigrations` to `safeMigrate`.
- [ ] **Step 6: Commit** `feat(db): copy the database before migrations and restore it on failure`.

### Task 4: Schema and migration for recurring rules

**Files:**
- Modify: `src/db/schema.ts`, `src/db/types.ts`
- Create: migration via `npx drizzle-kit generate --name recurring` (yields `src/db/migrations/0004_recurring.sql`, journal + `migrations.js` updated)
- Test: `src/db/migrations.test.ts`

**Interfaces:**
- Produces:
  - Table `recurringRules` (`recurring_rules`): `...base`, `merchant` text null, `currency` text not null, `totalMinor` int not null, `taxMinor` int null, `categoryId` text null, `folderId` text null, `notes` text null, `frequency` text `$type<RecurringFrequency>()` not null, `anchorDate` text not null, `monthDay` int null, `tz` text not null, `autoAdd` int boolean not null, `endDate` text null, `paused` int boolean not null default false, `lastGeneratedDate` text null
  - `receipts.recurringRuleId` text null and `receipts.recurringDate` text null
  - `uniqueIndex("receipts_recurring_occurrence_uq").on(t.recurringRuleId, t.recurringDate).where(sql\`deleted_at IS NULL AND recurring_rule_id IS NOT NULL\`)`
  - Types `RecurringFrequency = "weekly" | "monthly" | "yearly"`, `RecurringRule`, `NewRecurringRuleInput`

- [ ] **Step 1: Write failing tests** in `migrations.test.ts`:
  - after a full migrate, `recurring_rules` exists with the columns above;
  - inserting two live receipts with the same `(recurring_rule_id, recurring_date)` throws;
  - inserting a second one after soft-deleting the first succeeds;
  - two receipts with `recurring_rule_id` null do not conflict.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
  - Edit the schema and run `npx drizzle-kit generate --name recurring`.
  - Check the SQL has the partial index's `WHERE`. If drizzle-kit drops it, hand-edit the generated SQL.
  - The receipts FTS triggers (see the schema.ts warning) must not be dropped by the generated SQL. The existing FTS-trigger test in `migrations.test.ts` proves it.
- [ ] **Step 4: Run** `npx jest src/db` → PASS.
- [ ] **Step 5: Commit** `feat(db): recurring_rules table and occurrence link on receipts`.

### Task 5: Occurrence engine (pure)

**Files:**
- Create: `src/recurring/occurrences.ts`, `src/recurring/occurrences.test.ts`

**Interfaces:**
- Consumes: `formatLocal` (`src/capture/localTime.ts`).
- Produces:
  - `type RuleTiming = Pick<RecurringRule, "frequency" | "anchorDate" | "monthDay" | "endDate" | "paused" | "lastGeneratedDate">`
  - `todayIn(tz: string, now: Date): string` (`YYYY-MM-DD`)
  - `dueOccurrences(rule: RuleTiming, today: string): string[]`: dates after `lastGeneratedDate` (or from `anchorDate` inclusive when null), up to and including `today`, never after `endDate`; `[]` when `paused`
  - `nextOccurrence(rule: RuleTiming, after: string): string | null`: the first occurrence strictly after `after` (null past `endDate`)

- [ ] **Step 1: Write failing tests:**
  - Monthly, `monthDay` `-1`: Jan→`01-31`, Feb 2026→`02-28`, Feb 2028→`02-29`.
  - Monthly, `monthDay` 5, anchor `2026-01-05`, `lastGeneratedDate` `2026-03-05`, today `2026-06-10` → `["2026-04-05","2026-05-05","2026-06-05"]`.
  - Weekly from anchor `2026-11-02` (Mon), last `null`, today `2026-11-20` → `["2026-11-02","2026-11-09","2026-11-16"]`.
  - Yearly anchor `2024-02-29`, last `2024-02-29`, today `2027-03-01` → `["2025-02-28","2026-02-28","2027-02-28"]`.
  - `endDate` `2026-05-31` cuts the monthly list above to April and May.
  - `paused: true` → `[]`.
  - Today equal to an occurrence includes it. The day before excludes it.
  - `todayIn("Asia/Jakarta", new Date("2026-11-30T18:00:00Z"))` → `"2026-12-01"`.
  - `todayIn("Pacific/Pago_Pago", new Date("2026-12-01T05:00:00Z"))` → `"2026-11-30"`.
  - `nextOccurrence` for the monthly rule after `2026-06-05` → `"2026-07-05"`.
- [ ] **Step 2: Run** `npx jest src/recurring/occurrences` → FAIL.
- [ ] **Step 3: Implement** with integer date arithmetic: days-in-month helper, weekly stepping by 7 days via a day-number conversion.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(recurring): occurrence engine`.

### Task 6: Rules repository, catch-up and Undo

**Files:**
- Create: `src/recurring/rules.ts`, `src/recurring/rules.test.ts`, `src/recurring/catchUp.ts`, `src/recurring/catchUp.test.ts`, `src/recurring/useRecurringCatchUp.ts`
- Modify: `src/app/_layout.tsx` (call `useRecurringCatchUp()` next to `useFx()`), `src/db/repositories/receipts.ts` (`NewReceiptInput` accepts `recurringRuleId`, `recurringDate`)

**Interfaces:**
- Consumes: Task 4 types; Task 5 `dueOccurrences`, `todayIn`; `convertToHome` (`src/fx/convert.ts`); `createReceipt`; `notifyDataChanged` (`src/db/changes.ts`); `restoreLease` (`src/backup/restoreLease.ts`, `held()` / `onFree(cb)`).
- Produces:
  - `listRules(db): RecurringRule[]` (live, ordered by next due)
  - `createRule(db, input: NewRecurringRuleInput, now: Date): RecurringRule`. Sets `lastGeneratedDate = todayIn(tz, now)` when `anchorDate` ≤ today (no backfill).
  - `createRuleFromReceipt(db, receiptId: string, input: NewRecurringRuleInput, now: Date): RecurringRule`. Links the receipt (`recurringRuleId`, `recurringDate` = its local date) and sets `lastGeneratedDate` = the later of that date and today. Runs in one transaction.
  - `updateRule(db, id, patch, now: Date): RecurringRule`: `lastGeneratedDate = max(lastGeneratedDate, today)`
  - `setPaused(db, id, paused: boolean, now: Date)`: on resume, `lastGeneratedDate = max(lastGeneratedDate, today)`
  - `softDeleteRule(db, id)`: created receipts untouched
  - `runCatchUp(db, opts: { now: Date; home: string; fx: FxCache }): CatchUpResult`, where `type CatchUpResult = { createdIds: string[]; draftCount: number }`
  - `undoCatchUp(db, ids: string[]): void`: soft-deletes those receipts; does not rewind `lastGeneratedDate`
  - `useRecurringCatchUp(): { last: CatchUpResult | null; dismiss(): void }`: runs after unlock, on mount and on `AppState` → `active`; skips while `restoreLease.held()` and runs once on `onFree`

- [ ] **Step 1: Write failing tests** (`rules.test`, `catchUp.test`, better-sqlite3 `testDb()`):
  - `createRule` with anchor in January and today `2026-11-20` → `runCatchUp` creates 0 rows.
  - `createRuleFromReceipt` on a receipt dated `2026-11-20` → that receipt has `recurringRuleId` set; `runCatchUp` the same day creates 0; on `2026-12-20` it creates exactly 1.
  - A rule with `lastGeneratedDate` `2026-08-01`, monthly day 1, today `2026-11-20` → 3 rows dated `2026-09-01T09:00:00`, `-10-01`, `-11-01`, each with `purchasedTz` = the rule's tz and `purchasedAtUtc = localToUtc(...)`.
  - `autoAdd: true` → `status: "confirmed"`. Foreign currency gets `amountHomeMinor` from `convertToHome` with the given cache. A missing rate leaves `amountHomeMinor` null, like `fx/syncFx` back-fill expects.
  - `autoAdd: false` → `status: "draft"`, `draftCount` counts them.
  - Running `runCatchUp` twice in a row creates N rows, not 2N.
  - A pre-existing live row for the same (rule, date) is skipped, with no throw.
  - `updateRule` changing the day from 1 to 5 on `2026-11-10`, after `2026-11-01` was created → `runCatchUp` the same day creates 0.
  - `setPaused(true)` then `setPaused(false)` three months later → no rows for the paused months.
  - `softDeleteRule` keeps the created receipts.
  - `undoCatchUp(result.createdIds)` soft-deletes exactly those rows; a second `runCatchUp` does not recreate them.
  - Hook: with `restoreLease` held, mounting runs nothing; releasing the lease runs once.
- [ ] **Step 2: Run** `npx jest src/recurring` → FAIL.
- [ ] **Step 3: Implement.**
  - Each rule's inserts and its `lastGeneratedDate` update share one transaction.
  - Catch a SQLite UNIQUE violation per insert and skip that occurrence.
  - Call `notifyDataChanged()` once if anything was created.
- [ ] **Step 4: Run** `npx jest src/recurring src/db` → PASS.
- [ ] **Step 5: Commit** `feat(recurring): rules repository, catch-up and undo`.

### Task 7: Backup, replace and merge restore for recurring rules

**Files:**
- Modify: `src/backup/snapshot.ts` (`Snapshot.recurringRules`, `recurringRuleShape`, `receiptShape` gains the 2 columns), `src/backup/applySnapshot.ts` (`TABLES` gains `["recurringRules", recurringRules]` before `receipts`), fixtures in `src/backup/fixtures/`
- Test: `src/backup/snapshot.test.ts`, `src/backup/applySnapshot.test.ts`, `src/backup/importBackup.test.ts`

**Interfaces:**
- Consumes: Task 4 table and types.
- Produces: `Snapshot.recurringRules: RecurringRule[]`. Parsing an older snapshot without the key yields `[]`. Receipts without the 2 new keys get `null`.

- [ ] **Step 1: Write failing tests:**
  - Export → import (replace) round-trip keeps rules and linked receipts identical.
  - The existing schema-version-4 fixture still restores in both modes (rules empty, new receipt columns null).
  - Merge: local and backup each hold a live receipt with different ids for the same `(ruleId, "2026-11-01")` → no throw, the local row stays, the backup row is counted in `kept`, and its pages and line items are not inserted.
  - Merge: rule rows with `lastGeneratedDate` `2026-10-01` (local, newer `updatedAt`) and `2026-11-01` (backup) → the result keeps the local row's fields with `lastGeneratedDate` `2026-11-01`.
- [ ] **Step 2: Run** `npx jest src/backup` → FAIL.
- [ ] **Step 3: Implement.**
  - In `applyMerge`, before inserting receipts, drop any snapshot receipt whose live `(recurringRuleId, recurringDate)` pair already exists locally. Drop its pages and line items too.
  - After merging rules, set each rule's `lastGeneratedDate` to the max of both sides.
- [ ] **Step 4: Run** `npx jest src/backup` → PASS.
- [ ] **Step 5: Commit** `feat(backup): carry recurring rules through backup and merge`.

### Task 8: Due-day notifications for draft-type rules

**Files:**
- Add dependency: `npx expo install expo-notifications`. Add the plugin `"expo-notifications"` to `app.config.ts` `plugins`, with no remote-push entitlement (do not set `enableBackgroundRemoteNotifications`). On iOS, check the prebuild adds no `aps-environment` entitlement; if it does, strip it with a config mod.
- Create: `src/recurring/notify.ts`, `src/recurring/notify.test.ts`
- Modify: `src/recurring/useRecurringCatchUp.ts` (reschedule after every catch-up run, which includes the run after a restore frees `restoreLease`, and on a timezone change), `src/recurring/rules.ts` callers in the UI (Task 9) call `rescheduleAll` after writes, `src/app/_layout.tsx` (notification tap handler)

**Interfaces:**
- Consumes: Task 5 `nextOccurrence`, `todayIn`; Task 6 `listRules`.
- Produces:

```ts
export interface LocalScheduler {
  cancelAll(tag: "recurring"): Promise<void>;
  schedule(n: { id: string; title: string; body: string; at: { year: number; month: number; day: number; hour: 9; minute: 0 }; data: { ruleId: string; date: string } }): Promise<void>;
  permission(): Promise<"granted" | "denied" | "undetermined">;
  request(): Promise<"granted" | "denied">;
}
export async function rescheduleAll(db: AppDb, s: LocalScheduler, now: Date): Promise<number>; // count scheduled
export async function ensurePermissionForDraftRule(s: LocalScheduler): Promise<boolean>;      // asks only when undetermined
```

- [ ] **Step 1: Write failing tests** with a fake `LocalScheduler`:
  - only rules with `autoAdd: false`, not paused, not deleted, and with a next occurrence get scheduled;
  - one notification per rule, at 09:00 on that rule's `nextOccurrence(rule, todayIn(rule.tz, now))`;
  - the body equals `t("recurring.notifyBody", { merchant })` and contains no digits from the amount;
  - permission `denied` → `rescheduleAll` schedules nothing and does not throw;
  - `ensurePermissionForDraftRule` calls `request` only when `undetermined`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `notify.ts`, plus a device `LocalScheduler` on `expo-notifications`:
  - uses a calendar trigger in device local time;
  - tags notifications in `data`;
  - cancels only its own notifications.
- [ ] **Step 4: Wire it up:**
  - On foreground, if `deviceTimeZone()` differs from the last seen value (kept in a module variable), call `rescheduleAll`.
  - Tapping a notification calls `runCatchUp` (via the hook), then opens the draft whose `(recurringRuleId, recurringDate)` matches `data`.
- [ ] **Step 5: Copy (all locales):**
  - `recurring.notifyTitle`: "{{merchant}} is due"
  - `recurring.notifyBody`: "Confirm the amount."
- [ ] **Step 6: Run** `npx jest src/recurring` → PASS.
- [ ] **Step 7: Commit** `feat(recurring): due-day notifications for rules that create drafts`.

### Task 9: Recurring screens, "Repeat this…", labels and summary

**Files:**
- Create: `src/app/recurring/index.tsx` (list), `src/app/recurring/[id].tsx` (form; `new` for create, `?from=<receiptId>` for "Repeat this…"), `src/recurring/RuleForm.tsx`, `src/recurring/RuleForm.test.tsx`, `src/recurring/RecurringList.tsx`, `src/recurring/RecurringList.test.tsx`, `src/recurring/CatchUpBanner.tsx`, `src/recurring/CatchUpBanner.test.tsx`
- Modify: `src/app/(tabs)/settings.tsx` (row "Recurring" → `/recurring`), `src/receipts/ReceiptDetail.tsx` (action "Repeat this…" in `receipt-detail-actions`, confirmed receipts only), draft rows and review header (label "Recurring" when `recurringRuleId` is set), `src/app/(tabs)/index.tsx` (render `CatchUpBanner`), all four locale files

**Interfaces:**
- Consumes: Task 6 repository + `useRecurringCatchUp`; Task 8 `ensurePermissionForDraftRule`, `rescheduleAll`; existing `FolderPicker`, category picker, currency field, `parseAmountInput`, date field components.
- Produces: routes `/recurring`, `/recurring/[id]`.

- [ ] **Step 1: Write failing tests:**
  - **RuleForm:**
    - opened with `from=<receiptId>`, it is prefilled with that receipt's merchant, amount, currency, category, folder and notes; the start date is the receipt's date;
    - saving calls `createRuleFromReceipt`;
    - it validates: amount > 0, currency known, `monthDay` 1–28 or "Last day", end date ≥ start date;
    - turning "Add automatically" off and saving calls `ensurePermissionForDraftRule` once;
    - when the rule's `tz` differs from the device's, the text "Times in Asia/Jakarta" and a "Use my current time zone" action are shown.
  - **RecurringList:**
    - each row shows merchant, amount, frequency text and "Next: 1 Dec";
    - the header shows the monthly-equivalent total (weekly × 52 / 12, yearly / 12, rounded to minor units, home currency, skipping rules with no FX rate);
    - empty state with a "New" button.
  - **CatchUpBanner:**
    - for `{ createdIds: [a,b,c], draftCount: 2 }` it renders "3 recurring expenses added · 2 need confirming";
    - "Undo" calls `undoCatchUp([a,b,c])`;
    - "Review" opens the first draft.
  - **ReceiptDetail:** a "Repeat this…" action for confirmed receipts, absent for drafts.
  - **Banner copy:** exactly "Added 3 recurring expenses." and "2 need you to confirm the amount."; after Undo, "Removed 3 recurring expenses."
  - **Layouts** (mock `useLayout` with `LAYOUTS` from `src/layout/testing/layouts.ts`; add `foldInner: layoutFor({ width: 841, height: 701, left: 0, right: 0 })`, `foldInnerPortrait: layoutFor({ width: 701, height: 841, left: 0, right: 0 })` and `flipCover: layoutFor({ width: 360, height: 400, left: 0, right: 0 })`):
    - `phone`, `duoClosed`, `duoSideways`, `flipCover`: the list alone; tapping a rule pushes the form.
    - `duoPortrait`: icon rail plus one pane (foldable spec row "Duo open, portrait").
    - `duoLandscape`, `foldInner`: `TwoPane` with list and form side by side; the form pane is ≥ 280 dp.
    - Switching the mocked layout from `duoClosed` to `duoLandscape` with typed form values keeps the values and the selected rule.
  - **Contrast:** the "~" estimate prefix and the banner text pass 4.5:1 in light and dark.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** following the `organize/FolderForm` and `CategoriesScreen` patterns and the "UI and UX design" section above (reuse `DayGrid` from Task 2). Every rule write calls `rescheduleAll` afterwards.
- [ ] **Step 4: Run** `npx jest src/recurring src/receipts src/app src/i18n` → PASS.
- [ ] **Step 5: Commit** `feat(recurring): rule list, form, Repeat this and catch-up banner`.

### Task 10: End-to-end tests on iPhone, iPhone Duo and Android

**Files:**
- Create: `apps/mobile/e2e/` with Maestro flows (`recurring.yaml`, `payday.yaml`, `catchup-undo.yaml`, `duo-fold.yaml`), and `apps/mobile/e2e/README.md` (how to run)
- Modify: `src/dev/` (add a `__DEV__`-only deep link `meb://dev/clock?now=<iso>&tz=<IANA>` that overrides `now()` and the device zone for catch-up and Stats, so flows can jump in time without changing the device clock)

Tooling: Maestro CLI (`brew install maestro`), a dev tool only, not an app dependency. Targets:
- iOS: `iPhone 18 Pro` simulator and the `iPhone Duo` simulator (closed, open portrait, open landscape), via a local dev build (`npx expo run:ios`).
- Android: the owner's Redmi over USB (`adb devices` must list it), via an EAS development build or `npx expo run:android --device`.
- Android foldables: no device or emulator is available (no Android SDK emulator on this Mac). Covered by the layout tests in Task 9 and by the Duo simulator; mark Z Fold / Pixel Fold device rows `OWNER-PENDING` in the acceptance doc.

- [ ] **Step 1: Write the flows:**
  - `payday.yaml`: set Month starts on → Day 25; add a manual receipt dated the 26th of last month; Home shows it in this period and Stats shows "25 Oct – 24 Nov".
  - `recurring.yaml`: open a confirmed receipt → "Repeat this…" → Save; no duplicate appears; open Recurring and see the rule with "next" one month later.
  - `catchup-undo.yaml`: with the dev clock 3 months ahead, relaunch; the banner reads "Added 3 recurring expenses."; tap Undo; the feed returns to its previous count.
  - `duo-fold.yaml` (Duo simulator only): open the rule form while closed, type an amount, switch the simulator to the open posture; the form shows in the right pane with the typed amount.
- [ ] **Step 2: Run** each flow on iPhone 18 Pro, iPhone Duo and the Redmi: `maestro test e2e/<flow>.yaml`. Expected: all pass. Save screenshots to `docs/v1-recurring-evidence/` (synthetic data only, never real receipts).
- [ ] **Step 3: Commit** `test(e2e): Maestro flows for recurring, payday and fold`.

### Task 11: Device acceptance and docs

**Files:**
- Create: `docs/v1-recurring-acceptance.md` (link the Task 10 evidence; rows below are what Maestro cannot automate)
- Modify: `docs/store/privacy-answers.md` (note that local notifications send nothing), `docs/roadmap.md` (tick 1.0 items when done)

- [ ] **Step 1: Write the acceptance rows** (the owner runs them; status `OWNER-PENDING`):
  1. Permission prompt appears only when the first draft-type rule is saved, on iOS and Android.
  2. A notification arrives at 09:00 on the due day; tapping it opens the draft.
  3. Change the device timezone to UTC−11 and UTC+14 across a due date: exactly one occurrence, on the rule-zone date.
  4. Dev build with a deliberately failing migration: the "Your receipts are safe" panel shows, and the data is intact after reinstalling the good build.
  5. Fill the device to under 50 MB free: the free-space panel shows, and the app opens normally after space is freed.
  6. Proxy session (row D5 setup): no new hosts while notifications are scheduled or delivered.
- [ ] **Step 2: Run the full gates:** `npm test`, `npm run typecheck`, `npm run lint` (no new problems), `npx expo-doctor`. Record the counts in the acceptance doc.
- [ ] **Step 3: Commit** `docs: device acceptance for recurring, payday month and safe migration`.
