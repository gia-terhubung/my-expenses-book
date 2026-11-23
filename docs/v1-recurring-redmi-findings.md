# End-to-End Test Progress & Findings (Redmi 2409BRN2CY, Android 16)

Date: 2026-11-20
Environment:
- Device: Xiaomi Redmi 14C / model `2409BRN2CY`, Android 16
- App: `com.terhubung.myexpensesbook` (EAS Dev Client build installed 2026-11-20 11:50)
- Host: macOS, Metro connected via `adb reverse tcp:8081 tcp:8081`

---

## 1. Verified Working & Passed

### Safe Migration & Data Preservation
- **Status: PASS**
- Installing the new build over the previous install preserved user database and preferences.
- Inspection of `files/SQLite/` showed:
  - `meb.db.pre-upgrade` (372,736 bytes) was automatically created by `safeMigrate.ts` prior to applying migrations.
  - `meb.db` was cleanly migrated to schema `0004_recurring.sql`.
  - All existing receipts (521 items), custom folders, and preferences were intact.

### R8b: Review Form Keyboard & Floating Action Bar
- **Status: PASS on Android**
- Evidence: `docs/v1-recurring-evidence/redmi/screen-review-total-focused.png`
- On Android, focusing the `Total` field in the review form opens the system soft keyboard. Unlike iOS simulator observations where the floating bar could overlay input fields, Android's keyboard smoothly accommodates the view, keeping the `Total` field visible, accessible, and editable without accidentally tapping "Buang" (Discard). Tapping "Buang" separately triggers the discard confirmation modal as expected.

### E6: SQLite UNIQUE Constraint Driver Error Text
- **Status: PASS on Android**
- Evidence: `docs/v1-recurring-evidence/redmi/device-checks-redmi-01-unique-error-text.png`
- Executed via `myexpensesbook://db-check`:
  - `messages`: `["Error code 19: UNIQUE constraint failed: receipts.recurring_rule_id, receipts.recurring_date"]`
  - `matches_unique`: `true`
  - `tx_usable_after`: `true`

### Dev Clock on Android
- **Status: PASS**
- Tested deep link: `myexpensesbook://dev/clock?now=2026-10-26T03:00:00Z&tz=Asia/Jakarta`.
- App successfully moved "today" to 26 October 2026, updating Home statistics headers to compare against September as of day 26.

---

## 2. Identified Gap / Bug

### [GAP-01] Notification Permission Never Prompted on Android for Draft Rules

- **Status: FIXED and verified 2026-11-23.** `deviceScheduler.permission()` now returns "undetermined" whenever the permission is not granted and `canAskAgain` is true. Unit test in `deviceScheduler.test.tsx`. On the Redmi, `e2e/notify-prompt.sh` PASS: no prompt for the auto-add rule, the system prompt on the first draft rule (`docs/v1-recurring-evidence/redmi/notify-prompt-redmi-01..05*.png`).

- **Affects:** Acceptance row **R1** on Android 13+ (tested on Android 16).
- **Observed Behavior:**
  - Saving an auto-add rule ("Tambahkan otomatis" = ON): No notification prompt shown. (Expected & PASS).
  - Saving a draft-type rule ("Tambahkan otomatis" = OFF): Rule saved with draft tag, but **no system notification permission prompt was displayed**, and `android.permission.POST_NOTIFICATIONS` remained `granted=false`.
- **Root Cause Analysis:**
  1. In `apps/mobile/src/recurring/deviceScheduler.ts` line 49–52:
     ```typescript
     async permission() {
       const p = await Notifications.getPermissionsAsync();
       return p.granted
         ? "granted"
         : p.canAskAgain && p.status === Notifications.PermissionStatus.UNDETERMINED
           ? "undetermined"
           : "denied";
     }
     ```
  2. In `apps/mobile/src/recurring/notify.ts` line 51–54:
     ```typescript
     export async function ensurePermissionForDraftRule(s: LocalScheduler): Promise<boolean> {
       const p = await s.permission();
       if (p === "undetermined") return (await s.request()) === "granted";
       return p === "granted";
     }
     ```
  3. In `expo-notifications` on Android (see `NotificationPermissionsModule.kt` line 131–136):
     Before a user has ever been prompted for `POST_NOTIFICATIONS`, Android returns:
     `status: "denied"`, `granted: false`, `canAskAgain: true`.
     Android does not return `UNDETERMINED`.
  4. Because `p.status === UNDETERMINED` evaluates to `false`, `deviceScheduler.permission()` returns `"denied"`.
  5. `ensurePermissionForDraftRule` sees `"denied"` (not `"undetermined"`) and skips calling `s.request()`. The user is never prompted.

- **Recommended Fix:**
  Update `deviceScheduler.permission()` to treat `p.canAskAgain` as undetermined if permission is not yet granted:
  ```typescript
  async permission() {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return "granted";
    if (p.canAskAgain) return "undetermined";
    return "denied";
  }
  ```
  Or check platform specifics if iOS requires checking `status === UNDETERMINED`.

---

## 3. Follow-up 2026-11-23 (all done)

- GAP-01 fixed (above).
- E1 payday, E2 recurring, E3 catch-up and undo: PASS on the Redmi, run by the same flow scripts through the new `android)` branch of `apps/mobile/e2e/lib.sh`. Logs in `docs/v1-recurring-evidence/redmi/logs/`. Acceptance rows R1 (Android) and R7 updated in `docs/v1-recurring-acceptance.md`.
- The device data was restored from `~/MEB-e2e-backups/redmi-2409BRN2CY/20261120-115123` (the original; its `meb.db` is byte-identical to the other two 2026-11-20 backups). The app opened on it and re-ran the migration (`meb.db.pre-upgrade` created).
- Harness issues found and fixed on the way: `monkey -p <pkg> 1` can inject a screen rotation (replaced by `am start`); HyperOS ignores `settings put system accelerometer_rotation 0` (now `cmd window user-rotation lock 0`); Gboard autocorrected "Catchup" to "Catch-up"; WhatsApp heads-up popups covered buttons and got into screenshots (heads-up now off during runs, restored after).
