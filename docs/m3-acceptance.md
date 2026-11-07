# M3 acceptance: organize

Date: 2026-11-07. Branch feat/m3-organize. Status key: PASS / FAIL / OWNER-PENDING (needs a physical device) / BLOCKED (host problem, retry later).

## 1. Automated checks (host, apps/mobile)

| Check | Result | Status |
|---|---|---|
| `npx jest --maxWorkers=2` | Test Suites: 82 passed, 82 total. Tests: 570 passed, 570 total (includes `src/dev/seed.test.ts`: 500 seeded, 12+ months, unconverted rows, paging 500 rows at limit 50 under 2 s) | PASS |
| `npx tsc --noEmit` | no output, exit 0 | PASS |
| `npm run check:pii` | ok: 68 dump tokens checked against fixtures, none found | PASS |
| Android EAS development build | Build fd79f317-fa1f-47c4-8fa7-5deac7111dfd, account gia-terhubung. Re-checked 2026-11-07 in the final fix wave with `npx eas-cli build:view fd79f317-fa1f-47c4-8fa7-5deac7111dfd` (apps/mobile): status "in progress", started 11/7/2026 8:34:50 PM, Application Archive URL not yet available. Poll the same command for the final status and APK link. The build is from commit bbf6f87; it is a development client, so the later JS fixes load from Metro and do not need a new build. Build page: https://expo.dev/accounts/gia-terhubung/projects/my-expenses-book/builds/fd79f317-fa1f-47c4-8fa7-5deac7111dfd) | PENDING (still in progress at the final fix wave, one build only) |

M2 carry-overs closed in M3 (see `docs/m2-followups.md`): FX cache clobber race (bbf6f87), capture cancelWork double back (bbf6f87), native date picker (1d87ae7, 6891d7e), aggregates constraint (6146d5a).

## 2. Dev seed

Dev screen `/db-check` (`__DEV__` only, route group `(dev)`; Settings, Developer tools): button "Seed 500 synthetic receipts". It calls `seedSyntheticReceipts(db, 500, { home: "IDR", seed: 20261107, today })`: confirmed receipts, IDR/USD/EUR/JPY, about 9% of foreign rows unconverted (no home amount), all 11 default categories, 3 folders ("Demo Project Alpha", "Demo Trip Bali", "Demo Project Beta"), 18 months of dates, invented merchants (e.g. "Indomaret Sample"). Deterministic (mulberry32). The seed assumes home currency IDR: if onboarding picked another home currency, totals show many receipts as unconverted. Tapping it twice adds 500 more and 3 more folders; reset local data first to start clean.

## 3. iOS simulator evidence (iPhone 18 Pro Max, iOS 27)

Result: BLOCKED. After `simctl boot` the simulator stayed on the Apple boot logo for over 3 minutes (screenshots at that point show only the logo). `xcrun simctl openurl` of the dev-client link failed twice with "Operation timed out" (NSPOSIXErrorDomain code 60). Same host-side stall family as M2 section 2. In addition, there is no tap tooling (no idb/axe/maestro), so the seed button could not be pressed even on a healthy simulator. Metro was started and stopped; the simulator was shut down. No PNG exists, so no row is PASS. `docs/m3-evidence/` holds only `.gitkeep`.

| Row | Status | Note |
|---|---|---|
| Feed with totals | BLOCKED | sim stuck on boot logo |
| Detail | BLOCKED | same |
| Search with filters | BLOCKED | same |
| Folders tab with tax years | BLOCKED | same |
| Categories | BLOCKED | same |
| Landscape >= 840 pt: two-pane plus side rail | BLOCKED | same; Jest covers the window-class switch (`TwoPane.test.tsx`) |

Re-run when the simulator is healthy: seed via `/db-check`, then capture with `xcrun simctl io booted screenshot docs/m3-evidence/<name>.png`.

## 4. Android: Redmi 14C owner checklist

Install: open the APK link from section 1 on the phone, allow install from browser, open the dev client, start Metro on the Mac (`cd apps/mobile && npx expo start --dev-client`), enter the URL, phone on the same Wi-Fi. Finish onboarding first (set home currency IDR). Seed: Settings, Developer tools, DB check, tap "Seed 500 synthetic receipts".

| # | Check | Pass criterion | Status |
|---|---|---|---|
| R1 | Seed 500, then scroll the Receipts feed top to bottom | no visible stalls or blank gaps; month headers and totals shown | OWNER-PENDING |
| R2 | Search "indom" (type in the search field) | results appear within about 300 ms after the debounce | OWNER-PENDING |
| R3 | Open a receipt, Edit, tap the date field | native date picker opens; picking a date updates the field | OWNER-PENDING |
| R4 | Folders tab: delete a folder that has receipts | folder gone; its receipts stay in the feed (no folder) | OWNER-PENDING |
| R5 | Android back while editing a receipt | with no changes: leaves straight away. After typing a change: "Discard changes?" appears; Keep editing stays, Discard leaves without saving | OWNER-PENDING |
| R6 | TalkBack on, operate the native date field | field is announced, picker can be opened and a date chosen | OWNER-PENDING |
| R7 | Open FilterSheet, change fields without applying, rotate the phone | draft edits are kept after rotation | OWNER-PENDING |
| R8 | Open the feed with zero receipts (fresh install or after reset) | top spacing looks single, no doubled safe-area gap | OWNER-PENDING |

## 5. iOS: iPhone 12 Pro owner checklist

Needs a registered device build (`eas device:create`, interactive: owner step) or the Mac with `npx expo run:ios --device`. Seed as in section 4.

| # | Check | Pass criterion | Status |
|---|---|---|---|
| P1 | Rotate to landscape on the Receipts tab | two-pane plus side rail | OWNER-PENDING |
| P2 | Select a receipt in two-pane, rotate back to portrait | detail shows with a back control | OWNER-PENDING |
| P3 | Edit a receipt, type in notes, rotate | typed text stays | OWNER-PENDING |
| P4 | Tap the date field while editing | native date picker works; field shows the chosen date | OWNER-PENDING |
| P5 | Swipe down (sheet/modal edit) or swipe back while editing | with no changes: leaves. After a change: "Discard changes?" appears and the sheet/screen stays until Discard | OWNER-PENDING |
| P6 | VoiceOver on, operate the native date field | field announced, date can be changed | OWNER-PENDING |
| P7 | Open FilterSheet, change fields, rotate | draft edits kept | OWNER-PENDING |
| P8 | Empty feed | top spacing single, no doubled safe-area gap | OWNER-PENDING |

## 6. Galaxy Z Flip 6 owner checklist

| # | Check | Pass criterion | Status |
|---|---|---|---|
| F1 | Open a receipt, start editing, fold and unfold | no state loss; typed text kept | OWNER-PENDING |
| F2 | Same with app lock enabled | lock does not re-trigger on fold or unfold | OWNER-PENDING |
| F3 | Cover screen (Flex Window) | layout compact and usable | OWNER-PENDING |
| F4 | Main screen in landscape | two-pane | OWNER-PENDING |
| F5 | FilterSheet open with edits, fold/unfold | draft edits kept | OWNER-PENDING |
| F6 | Empty feed | top spacing single | OWNER-PENDING |
| F7 | TalkBack on the native date field | operable | OWNER-PENDING |
| F8 | Back while editing | after a change: "Discard changes?" prompt; with no changes: leaves | OWNER-PENDING |

## 7. Carried forward from M2 (still open, not duplicated here)

All OWNER-PENDING rows of `docs/m2-acceptance.md` remain open and block M2 sign-off: Redmi 14C A1 to A20 (OCR check, capture, lock, offline), iPhone 12 Pro I1 to I11, Z Flip 6 Z1 to Z5 (AI path). In particular A8, A15 and I8 (keyed pop of `/lock` must unmount on device). The M2 simulator capture stall (cause UNKNOWN, M2 section 2) is also still unresolved, and the M3 boot stall above suggests a host simulator problem rather than an app hang, but that is not proven.

## 8. Summary

Host checks PASS. Seed added and tested. Simulator evidence BLOCKED (boot stall, no tap tooling). Android build: PENDING (still in progress when re-checked in the final fix wave; no APK link yet, one build only). All device rows OWNER-PENDING.
