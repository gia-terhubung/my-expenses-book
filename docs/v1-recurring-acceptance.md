# 1.0 acceptance: recurring expenses, payday month and safe migration

Date: 2026-11-20. Branch main. Status key: PASS (with evidence) / OWNER-PENDING (needs a physical device or the owner's setup) / BLOCKED (cannot run yet).

Design: `docs/superpowers/specs/2026-11-20-v1-recurring-payday-snapshot-design.md`. Evidence for the PASS rows is in `docs/v1-recurring-evidence/` (screenshots) and `docs/v1-recurring-evidence/logs/` (run logs). The flows are AXe scripts in `apps/mobile/e2e/` (see its README). Run them with `E2E_ALLOW_WIPE=1 e2e/<flow>.sh <UDID>`. They wipe the app's data, after a backup.

## 1. Automated gates (host, apps/mobile)

| Check | Result | Status |
|---|---|---|
| `npm test` | Test Suites: 156 passed, 156 total. Tests: 1326 passed, 1326 total | PASS |
| `npm run typecheck` | no output, exit 0 | PASS |
| `npm run lint` | 19 problems (4 errors, 15 warnings). The 4 errors were on `main` before this work (capture.tsx, BackupReminder.tsx x2, useWhenUnobscured.ts). No new errors | PASS (no new errors) |
| `npx expo-doctor` | 19/20 checks passed. The failing check is "packages match versions required by installed Expo SDK" (17 packages out of date). It failed before this work (see `docs/m5-acceptance.md`) | PASS (unchanged) |

## 2. Simulator flows (iPhone Duo, iOS simulator 06C208F7)

Posture was driven from the command line (`axe hinge set closed|open`, `axe rotate`), so the Duo needs no owner step. The dev clock (`myexpensesbook://dev/clock?now=<ISO>&tz=<zone>`) moves "today" in debug builds only.

| ID | Steps | Expected | Status |
|---|---|---|---|
| E1 | Payday: Settings > Month starts on > Day 25. Add a receipt dated 26 Oct 2026. Set today to 20 Nov. Open Home and Stats | Home header "This month, $12.50" with the row. Stats range "25 Oct – 24 Nov", $12.50 | PASS: `v1-recurring-evidence/payday-iphoneduo-01..04*.png`, `v1-recurring-evidence/logs/payday-iphoneduo.log` |
| E2 | Recurring: on a saved receipt tap "Repeat this…". Check the prefilled form. Save. Run a catch-up (background, foreground) | Form has merchant, amount 30, Monthly. The receipt no longer shows "Repeat this…". Exactly one "Repeat Test Gym" row, also after catch-up. Recurring list: "Repeat Test Gym, $30.00, Monthly, next 20 Dec" | PASS: `v1-recurring-evidence/recurring-iphoneduo-01..04*.png`, `v1-recurring-evidence/logs/recurring-iphoneduo.log` |
| E3 | Catch-up and undo: rule on 20 Nov. Set the clock to 20 Feb 2027. Return to the app. Tap Undo | "Added 3 recurring expenses." Rows 1 to 4. After Undo: "Removed 3 recurring expenses." Rows back to 1 | PASS: `v1-recurring-evidence/catchup-undo-iphoneduo-01..03*.png`, `v1-recurring-evidence/logs/catchup-undo-iphoneduo.log` |
| E4 | Fold, form opened closed: open the form folded, type values, unfold | Values kept. Layout seen: pushed form, full width (accepted for 1.0, ruling T9) | PASS: `v1-recurring-evidence/duo-fold-iphoneduo-01..02*.png` |
| E5 | Fold, form opened open: open unfolded, fold, unfold, then rotate to portrait (669 pt wide) | List left and form right. Folded: form alone. Unfolded: two panes again. Portrait: one pane. Amount 45.75 kept throughout | PASS: `v1-recurring-evidence/duo-fold-iphoneduo-03..06*.png`, `v1-recurring-evidence/logs/duo-fold-iphoneduo.log` |
| E6 | UNIQUE error text: `myexpensesbook://db-check` > "UNIQUE error text" | Message matches `/UNIQUE constraint failed/`, not wrapped, transaction still takes writes | PASS: `v1-recurring-evidence/device-checks-iphoneduo-01-unique-error-text.png`. Text: "Error code 19: UNIQUE constraint failed: receipts.recurring_rule_id, receipts.recurring_date" |
| E7 | Notification prompt, iOS: save the first rule with "Add automatically" on, then the first rule with it off | No prompt for the auto-add rule. The system prompt shows when the first draft-type rule is saved | PASS: `v1-recurring-evidence/device-checks-iphoneduo-02..04*.png` |

Note for E6: the duplicate path cannot be reached from the normal UI. "Repeat this…" sets the last generated date to the later of the receipt date and today, and catch-up skips existing rows. So it was exercised through the dev check (real index, real driver, rolled back).

## 3. Owner device rows

Run these on the owner's devices (iPhone, Redmi, foldables). Use a dev or preview build. Tick the status here when done.

| ID | Steps | Expected | Status |
|---|---|---|---|
| R1 | Fresh install, iOS and Android. Save a rule with "Add automatically" on. Then save a rule with it off | No notification prompt after the first. The prompt appears only when the first draft-type rule is saved. (Android 13+ shows its own prompt at that moment.) iOS simulator already PASS (E7); a real iPhone and the Redmi still to run | OWNER-PENDING |
| R2 | Save a draft-type rule due tomorrow. Leave the app closed. Wait for 09:00 on the due day | One notification arrives at 09:00 device-local time. Tapping it opens the draft receipt | OWNER-PENDING |
| R3 | Rule due on a known date. Set the device timezone to UTC−11, then to UTC+14, across that date. Open the app each time | Exactly one occurrence, dated on the rule-zone date, in both zones. No duplicate and no skipped day | OWNER-PENDING |
| R4 | Build a dev build with a deliberately failing migration. Install it over a build with data | The "Your receipts are safe" panel shows. Reinstall the good build: the data is intact | OWNER-PENDING |
| R5 | Fill the device to under 50 MB free. Open the app after an upgrade | The free-space panel shows. After space is freed, the app opens normally | OWNER-PENDING |
| R6 | Proxy session (Proxyman or Charles, as in row D5 of `docs/m5-acceptance.md`). Save a draft rule, wait for the notification to be scheduled and delivered | No new hosts compared with the D5 list. On Android, expo-notifications' FCM service stays inert: no `google` hosts come from it (ML Kit hosts from D5 are separate) | OWNER-PENDING |
| R7 | Redmi: run the flows E1 to E3 in section 2 by hand (payday, recurring, catch-up and undo) | Same results as E1 to E3. The e2e scripts have only an iOS branch; an `android)` adb branch can be added to `apps/mobile/e2e/lib.sh` | OWNER-PENDING |
| R8 | iPhone 18 Pro: the section 2 flows, with the fold rows skipped | Same results as E1 to E3 and E6 | OWNER-PENDING |
| R9 | Android foldable (Z Flip 6 or similar): open the rule form, fold and unfold | No state loss. The form keeps its values | BLOCKED: no device |

## 4. Found during acceptance

Not fixed in this work.

1. Review form, keyboard up: the floating Discard/Save bar sits over the Total field. A tap on Total hits Discard and opens "Discard this receipt?". The e2e flows dismiss the keyboard after each field. Fix idea: scroll the focused field above the bar.
2. iOS date field: the accessible wrapper exposes only "Date", with no value, so VoiceOver does not announce the date. Check it with VoiceOver (row D6 in `docs/m5-acceptance.md`).

Fixed during acceptance: Settings > Recurring crashed ("Maximum update depth exceeded") on any install with FX tables. `usePrefFrom` now keeps the previous snapshot while the JSON is unchanged (commit 9549cea).

## 5. Privacy

- `docs/store/privacy-answers.md` now says local notifications send nothing.
- The web privacy policy (`apps/web`) needs no change. Local notifications are scheduled and delivered on the device. No token, no server, no new host. This task did not touch it.
