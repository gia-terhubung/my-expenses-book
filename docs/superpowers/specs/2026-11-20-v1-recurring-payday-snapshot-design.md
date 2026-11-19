# 1.0 additions: recurring expenses, payday month, pre-upgrade snapshot

Date: 2026-11-20. Status: draft for owner approval.

## Intent and why

Competitor review research (2026-11-19, ~11,700 App Store reviews across receipt apps and budget apps, US/GB/AU/IN/DE/ID) showed:

- The #1 complaint everywhere is **losing data**, usually after an update or a sync failure.
- Freelancers and households want **recurring expenses** (rent, subscriptions, bills) and a **month that starts on payday**.
- Users leaving paid receipt apps also complain about **bloat**, so we add only what fits receipt users and skip budgets, debts and widgets.

The first 100 users we want are people leaving paid receipt apps (Smart Receipts, SimplyWise, Expensify individual users): freelancers at tax time and travellers claiming expenses.

The owner chose to put all three into 1.0 before launch. Launch is waiting on the bank account and Paid Apps agreement anyway, and a database change is safest before any real user data exists.

## Goals

1. **Recurring expenses.** Weekly, monthly or yearly rules that create expenses. Each rule has an "Add automatically" switch: on saves the expense directly, off creates a draft to confirm.
2. **Notifications** on the due day for draft-type rules only.
3. **Month starts on payday.** A setting for the day 1–28. Home and Stats use the pay period.
4. **Pre-upgrade snapshot.** Copy the encrypted DB before migrations; restore it if they fail.

## Non-goals

- Budgets, debts and receivables, widgets (owner and research: budget-app territory; widgets also clash with the encrypted DB and lock-screen privacy).
- Recurring rules in the shared household book (2.0).
- "Every N days" frequencies, split bills, recurring line items.
- Background execution. Nothing runs while the app is closed except OS-scheduled local notifications.

## Anti-goals

- An auto-created expense lands on the wrong date or is created twice. That is data the user did not enter, so it destroys trust.
- Any network call added by these features (notifications are local only).
- Stats or search cluttered with future expenses that haven't happened.
- A failed upgrade that leaves the app unable to open.

## Constraints from the existing app

- Receipts store `purchased_at_local` (wall-clock ISO), `purchased_tz` (IANA, nullable), and `purchased_at_utc` (derived). Stats, search and export work on local date strings (`stats/stats.ts`: "integer/string arithmetic only, no Date").
- `capture/localTime.ts` has `deviceTimeZone()` and `formatLocal(date, tz)`.
- Every row has `id` (UUIDv7), `updatedAt`, `deletedAt`, `version` (sync-ready, used by backup merge `backup/applySnapshot.ts`). New tables must follow this.
- The backup snapshot (`backup/snapshot.ts`) lists the tables it carries. A new table must be added there, to both replace and merge restore, and to the backup fixtures and tests.
- Prefs live in encrypted MMKV (`prefs/prefs.ts`). `taxYearStartMonth` is the pattern for a period setting.
- The DB is SQLCipher, opened in `db/client.ts` (`openDatabase`, `openWithStore`). Migrations are Drizzle (`db/migrations`, 4 so far).
- Manual entries without a photo already exist (`review/manualDraft.ts`). Drafts and the review screen already exist.
- The app has no notifications library today.

## Approaches considered

| Piece | Chosen | Rejected and why |
|---|---|---|
| Recurring generation | **Catch-up on app open**: a rules table; on launch and on returning to the foreground, create every due occurrence as a normal `receipts` row | Pre-generate future rows: clutters Stats and search, and editing a rule means rewriting rows. Background task: iOS runs it rarely and unpredictably. |
| Notifications | **`expo-notifications`, local only**, one scheduled notification per draft-type rule (its next due date), rescheduled after catch-up or edit | Scheduling many ahead: iOS caps pending local notifications at 64. |
| Upgrade safety | **Copy the encrypted DB file before pending migrations**; restore on failure | A full backup export each upgrade: slow, includes images, user-facing files. |
| Payday month | **Extend the period functions in `stats/stats.ts`**, following `taxYearPacePeriods` | None worth considering. |

The owner picked option C for recurring behaviour (per-rule "Add automatically" switch) and notifications for draft-type rules only.

## Design

### 1. Recurring expenses

**Data: new table `recurring_rules`** (sync base columns: `id`, `createdAt`, `updatedAt`, `deletedAt`, `version`):

| Column | Meaning |
|---|---|
| `merchant`, `currency`, `totalMinor`, `taxMinor`, `categoryId`, `folderId`, `notes` | Template copied into each created expense |
| `frequency` | `weekly` \| `monthly` \| `yearly` |
| `anchorDate` | Local date `YYYY-MM-DD` of the first occurrence. Weekly uses its weekday; yearly uses its month and day. |
| `monthDay` | Monthly only: `1`–`28`, or `-1` meaning "last day of the month" |
| `tz` | IANA zone the rule was created in (see Timezones) |
| `autoAdd` | Boolean, the "Add automatically" switch |
| `endDate` | Optional local date; no occurrences after it |
| `paused` | Boolean |
| `lastGeneratedDate` | Local date of the latest occurrence already created (null before the first) |

**Receipts get one new nullable column `recurring_rule_id`** plus `recurring_date` (the occurrence's local date). A partial unique index on `(recurring_rule_id, recurring_date) WHERE deleted_at IS NULL` makes double creation impossible, even if catch-up runs twice concurrently. A soft-deleted occurrence does not block its date, but catch-up never revisits dates on or before `lastGeneratedDate`, so a deleted occurrence is not recreated.

Yearly rules anchored on 29 Feb fall on 28 Feb in non-leap years.

**Catch-up** (pure function plus a thin DB step):

1. Compute "today" as the local date in the rule's `tz` (see Timezones).
2. List occurrences after `lastGeneratedDate` (or from `anchorDate`) up to today, stopping at `endDate`. Skip if `paused`.
3. In one transaction, insert one receipt per occurrence: `status = confirmed` if `autoAdd`, else `draft`. Set `parseSource = manual`, no pages. Then set `lastGeneratedDate`. The unique index turns a duplicate into a skip, not an error.
4. FX: manual drafts set no FX at creation (`review/manualDraft.ts`; FX is computed in `review/form.ts` on save and back-filled by `fx/syncFx.ts`). Draft occurrences follow that path. Auto-added (confirmed) occurrences must compute FX at catch-up using the rate for the occurrence date. If the rate isn't cached and the device is offline, use the latest cached rate and set `fxApproximate`, exactly as manual entry does today.
5. If anything was created, show one summary: "3 recurring expenses added" (with "2 need confirming" when drafts were created). Tapping it opens the drafts list filtered to recurring.

Catch-up runs after unlock, on app start and on return to the foreground. It never runs while a restore lease is held (`backup/restoreLease.ts`).

**No backfill on create or resume (owner decision):**

- "Repeat this…" links the source receipt as the first occurrence: set its `recurring_rule_id` and `recurring_date` (its local purchase date) and set the rule's `lastGeneratedDate` to that date. No duplicate is created.
- A rule saved with a start date in the past starts at the next due date after today. Past occurrences are never created. Set `lastGeneratedDate` to today in the rule's tz on save.
- Resuming a paused rule starts at the next due date. On resume, set `lastGeneratedDate = max(lastGeneratedDate, today)`. Paused periods stay empty.

So catch-up only fills gaps when the app wasn't opened. There is no catch-up cap for that case: every missed occurrence is created with its correct date, and the summary's "Undo" deletes the rows created by that catch-up. (My call: a wrong total is worse than many rows.)

**Editing a rule** affects only future occurrences: occurrences after today in the rule's tz. On save, set `lastGeneratedDate = max(lastGeneratedDate, today)` so a changed day, frequency or start date never creates an extra occurrence for the current period. (My call.) **Deleting** soft-deletes the rule. Expenses already created stay; their `recurring_rule_id` stays as history.

**UI**

- From a saved receipt: "Repeat this…" opens the rule form prefilled from that receipt.
- Settings > Recurring: a list of rules with the next due date and a monthly-equivalent total, plus New.
- Rule form fields: merchant, amount, currency, category, folder, notes, frequency, day, start date, end date (optional), Add automatically (switch), Pause.
- Drafts created by a rule show a "Recurring" label in the drafts list and on the review screen.

### 2. Notifications (draft-type rules only)

- Library: `expo-notifications`, local scheduling only. No push token is requested and nothing goes to a server.
- Ask for permission only when the user saves their first rule with Add automatically off. If declined, the rule still works; the drafts appear on the next app open.
- Each draft-type rule has at most one pending notification, for its next due date at **09:00 device local time**. Text: "Electricity is due. Confirm the amount." Tapping it runs catch-up and opens that draft.
- Reschedule all rule notifications after: catch-up, rule create/edit/pause/delete, restore from backup, and a timezone change detected on foreground.
- Content must not include amounts (it can show on the lock screen). Merchant name only.
- Update `docs/store/privacy-answers.md` and the privacy policy only if the library changes what data leaves the device (it shouldn't; confirm in the device proxy check D5).

### 3. Month starts on payday

- New pref `monthStartDay: number` (1–28, default 1) under Settings, beside the tax year setting.
- A pure function `payPeriodOf(localDate, startDay)` returns `{ from, to, label }`:
  - `from` is the most recent day `startDay` on or before the date, `to` is the day before the next one.
  - The label is the month that contains most of the period's days: start day ≤ 15 → the start month; start day > 15 → the end month. Example: start day 25 → 25 Oct–24 Nov is "November".
- `pacePeriods(today)` gains a `startDay` argument. "This period so far" vs "previous period up to the same day offset". With `startDay = 1` it must return exactly what it returns today (existing tests stay green).
- Home (`receipts/TotalsHeader.tsx`) and Stats month mode and month bars (`stats/StatsScreen.tsx`, `stats/MonthBars.tsx`) use pay periods. When `startDay ≠ 1`, show the range under the heading ("25 Oct – 24 Nov").
- Search filters and export presets **stay on calendar months**. Accountants and tax returns use calendar months. This is my call, so state it in the setting's helper text: "Used by Home and Stats. Exports and search use calendar months."

### 4. Pre-upgrade snapshot

- In `db/DatabaseProvider.tsx`, where `useMigrations` runs (it already has the `dbError.migrationFailed` panel), before running migrations: if the DB file exists and at least one migration is pending, close nothing yet, checkpoint the WAL, and copy the DB file to `<db>.pre-upgrade` (same SQLCipher key, so the copy stays encrypted).
- Run migrations. On success, keep the copy until the next successful launch, then delete it. On failure: close the DB, replace it with the copy, reopen, and show the existing DB error panel with a new message: "The update couldn't upgrade your data. Your receipts are safe. Please update the app again or contact support." Log the error to the in-memory error log.
- If the copy itself fails (for example, low storage), do not migrate. Show the "free up space" message and retry on next launch.
- Only one copy exists at a time. Images are not copied (migrations don't touch them).

### Timezones

The rule: **recurring dates are wall-calendar dates in the zone where the rule was made**, the same way receipts keep the local time of purchase.

- A rule stores the IANA `tz` of the device when it is created (`deviceTimeZone()`).
- "Is it due?" compares the occurrence date with today's local date **in the rule's tz**, not the device's current zone. A Jakarta rent rule due on the 1st becomes due when it's the 1st in Jakarta, even if the owner is in Los Angeles. Catch-up never fires early or twice because of travel.
- Each created receipt gets `purchased_at_local = <occurrence date>T09:00:00`, `purchased_tz = rule.tz`, and `purchased_at_utc` derived from those. 09:00 avoids midnight values that shift to the previous day if anything ever converts naively.
- Editing a rule shows its zone when it differs from the device's ("Times in Asia/Jakarta"), with an option to switch the rule to the current zone.
- Notifications are scheduled at 09:00 in the **device's current zone** on the occurrence date. When the zone changes (detected on foreground), reschedule. The notification is a nudge; the catch-up rule above decides what gets created.
- DST: dates are calendar dates, so DST never moves an occurrence. 09:00 local exists on every DST transition day.
- Payday periods use local date strings, which already reflect each receipt's own purchase zone. Nothing new is needed.

### Backup, restore, merge

- `recurring_rules` is added to the backup snapshot, to replace and merge restore (merge uses rule C4 like every other table), and to the backup fixtures and tests.
- After a restore, run catch-up and reschedule notifications.
- **Merge conflict on occurrences (my call):** `applyMerge` matches by `id` only, so two phones running the same rule can hold different rows for the same `(recurring_rule_id, recurring_date)`. Before inserting a backup receipt row, merge checks for a live local row with the same pair. If one exists, the backup row is skipped and counted as `kept` (local wins); its pages and line items are skipped too. Without this the partial unique index would throw and abort the whole merge.
- Merge takes the larger `lastGeneratedDate` of the two rule rows regardless of which row wins C4, so neither phone re-creates occurrences the other already made.
- Older backups without `recurring_rules` must still restore.

### Testing

- **Pure functions (unit):** occurrence listing for each frequency, last-day-of-month, 29 Feb, end date, pause; pay period boundaries and labels (start days 1, 15, 16, 25, 28; year boundary; leap year); "today in rule tz" for travel cases (rule in Asia/Jakarta, device in America/Los_Angeles and in Pacific/Kiritimati).
- **DB:** catch-up creates exactly N rows, is idempotent (run twice → same rows), respects the unique index, sets drafts vs confirmed correctly. Snapshot copy-and-restore with a deliberately failing migration.
- **Backup:** round-trip with rules; old-backup restore still works; merge doesn't duplicate occurrences.
- **UI:** rule form validation, "Repeat this…" prefill, summary + Undo, the Recurring label, the payday setting helper text, Home/Stats ranges.
- **Device (owner):** notification permission flow and delivery on iOS and Android; change the device timezone and confirm no early or duplicate creation; snapshot restore with a forced migration failure in a dev build.

## Left to the builder

- Exact file and component layout, following the existing `organize/`, `review/`, `settings` patterns.
- The summary's visual form (toast vs banner), matching existing feedback patterns.
- How the drafts list filter "Recurring" is exposed.
- Migration naming and Drizzle snapshot handling.

## Owner decisions in this doc

- Recurring behaviour: per-rule "Add automatically" switch (option C).
- Notifications for draft-type rules only.
- No backfill: "Repeat this…" links the source receipt; past start dates and resume start at the next due date.

## Calls I made (owner, please check)

1. No catch-up cap when the app wasn't opened; Undo on the summary instead.
2. Search and export keep calendar months; only Home and Stats use pay periods.
3. Created expenses are timed 09:00 in the rule's zone.
4. Notifications at 09:00 device time, merchant name only, no amount.
5. Editing a rule changes future occurrences only.
6. The pre-upgrade copy is kept until the next successful launch, then deleted.
7. Editing a rule never creates an occurrence for today or earlier (`lastGeneratedDate` advances to today).
8. Merge restore: when both phones hold a live occurrence for the same rule and date, the local one wins and the backup's is skipped.
