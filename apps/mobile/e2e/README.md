# End-to-end flows

Bash scripts that drive a dev build through its accessibility tree. No test framework, no app
dependency: iOS simulators use [AXe](https://github.com/cameroncooke/AXe) (`axe`) and
`xcrun simctl`; Android devices use `adb` and `uiautomator dump` (see [Android](#android)).

| Script | What it checks |
| --- | --- |
| `payday.sh` | Month starts on Day 25; a receipt dated 26 Oct counts in the period current on 20 Nov; Stats shows "25 Oct – 24 Nov". |
| `recurring.sh` | Receipt > "Repeat this…" > Save adds no second expense; Recurring lists "Monthly, next 20 Dec". |
| `catchup-undo.sh` | Dev clock 3 months ahead, app back to the foreground: "Added 3 recurring expenses."; Undo returns the feed to 1 row. |
| `notify-prompt.sh` | Android only. Saving an auto-add rule asks nothing; saving the first draft-type rule shows the system notification prompt (R1). Needs an install that has never asked. |
| `duo-fold.sh` | iPhone Duo only. Rule form keeps typed values across fold, unfold and rotation; two panes when open. |
| `duo-nav.sh` | iPhone Duo only. Native navigation: the four tabs, Home's + menu (Scan / Import / Add manually), a folder page's Back, Export, ⋯ and + in the side column, the short column held sideways (+ inside ⋯), Filters kept across fold and unfold, tab bar (not sidebar) when open. |
| `lib.sh` | Shared helpers (tap by label with wait/retry, fill and read back a field, assert visible, screenshots, dev clock, posture). |

## Run

1. Boot the simulator and install a dev build, then keep Metro running:

   ```sh
   cd apps/mobile
   npx expo run:ios --device <UDID>       # builds, installs, starts Metro
   # or, with the app already installed:
   npx expo start --dev-client             # Metro only (not with CI=1: that turns off reloads)
   ```

2. Run a flow with the simulator's UDID (`axe list-simulators`):

   ```sh
   E2E_ALLOW_WIPE=1 e2e/payday.sh <UDID>
   ```

   Each flow starts from an empty app: it deletes the app's database and prefs
   (`Documents/SQLite`, `Documents/mmkv` in the app container) and goes through onboarding
   (English, USD, no app lock). The keychain master key is kept.

   **Wipe guard.** Without `E2E_ALLOW_WIPE=1` a flow refuses to start and changes nothing.
   With it, the app's whole `Documents/` folder is first copied to
   `~/MEB-e2e-backups/<UDID>/<timestamp>/` (outside the repo; override the root with
   `E2E_BACKUP_ROOT`) and the path is printed. Put the data back afterwards with:

   ```sh
   bash -c 'source e2e/lib.sh; restore_app_data <UDID> ~/MEB-e2e-backups/<UDID>/<timestamp>'
   ```

   Several flows in a row each make their own backup; restore the **first** one to get back the
   data from before the runs. Backups hold real data if the simulator had any: delete them when
   done.

3. Screenshots go to `docs/v1-recurring-evidence/<flow>-<device>-<NN>-<step>.png`
   (override with `E2E_EVIDENCE_DIR`). A failing step saves `...-FAILED.png` and exits 1.

Only synthetic data: the flows type their own merchants ("Payday Test Cafe", ...). Never run
them against real receipts.

## Dev clock

Dev builds open `myexpensesbook://dev/clock?now=<ISO instant>&tz=<IANA zone>`: it shifts the
app's `now()` (catch-up, Home, Stats, the date of a manual receipt) and the device zone, then
returns to Home. `?reset=1` (or no params) clears it. Use `Z` instants (`2027-02-20T03:00:00Z`);
a `+07:00` offset also works. The clock is in memory only, so a cold start clears it; flows that
need a catch-up run send the app to the background and back instead of relaunching. Release
builds redirect the route to Home and never read the override (`__DEV__` is false).

## Device checks (manual, done once per platform)

- UNIQUE error text: dev build, `myexpensesbook://db-check` > "UNIQUE error text". It inserts a
  duplicate recurring occurrence inside a rolled-back transaction and shows the driver's
  message, whether it matches `/UNIQUE constraint failed/`, and whether the transaction still
  takes writes.
- Notification prompt: on an install that has never asked, save an auto-add rule (no prompt),
  then a rule with "Add automatically" off (the system prompt appears).

## Android

Debug (dev client) build installed, Metro running on the host, device connected over USB or
wireless adb. Pass the adb serial (`adb devices`) instead of a UDID:

```sh
E2E_PLATFORM=android E2E_ALLOW_WIPE=1 E2E_DEVICE_TAG=redmi \
  E2E_EVIDENCE_DIR="$PWD/../../docs/v1-recurring-evidence/redmi" e2e/payday.sh <serial>
```

- `e2e_init` runs `adb reverse tcp:8081 tcp:8081`, so a cold start loads the bundle from Metro.
- For the run it locks the screen to portrait (`cmd window user-rotation lock 0`) and turns off
  heads-up notifications (other apps' popups cover buttons and leak messages into screenshots).
  Both settings are put back on exit.
- The backup is `run-as tar` of the app's `files/` and `shared_prefs/` into
  `~/MEB-e2e-backups/<serial>/<timestamp>/app-data.tar`; the wipe removes `files/SQLite` and
  `files/mmkv`. Restore with
  `E2E_PLATFORM=android bash -c 'source e2e/lib.sh; restore_app_data <serial> <backup-dir>'`.
- Differences from iOS the helpers absorb: a text field's label is its `content-desc` (its text
  is the value, blank while it shows the hint); child texts already in a parent's
  `content-desc` are skipped, as iOS merges them; "Back" also matches the header's
  "Navigate up"; words are typed last-first with `MOVE_HOME` in between so Gboard's
  autocorrect never fires ("Catchup" became "Catch-up").
- Check screenshots before committing them: a notification that arrives during a run can still
  show in the status bar.
