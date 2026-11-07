# M4 acceptance: export and backup

Date: 2026-11-07. Branch feat/m4-export-backup. Status key: PASS / FAIL / OWNER-PENDING (needs a physical device) / PENDING (blocked on an owner decision) / SKIPPED.

## 1. Automated checks (host, apps/mobile)

| Check | Result | Status |
|---|---|---|
| `npx jest --maxWorkers=2` | Test Suites: 100 passed, 100 total. Tests: 736 passed, 736 total | PASS |
| `npx tsc --noEmit` | no output, exit 0 | PASS |
| `npm run check:pii` | ok: 68 dump tokens checked against fixtures, none found | PASS |
| `npx expo-doctor` | 20/20 checks passed. No issues detected | PASS |
| `npx expo prebuild --clean --no-install --platform android` | Run in a throwaway copy of apps/mobile (node_modules symlinked), because `apps/mobile/android` and `apps/mobile/ios` exist locally and are gitignored (`--clean` would wipe them). Finished prebuild without errors. Copy deleted afterwards; no tracked file changed. iOS prebuild not run | PASS |
| Config plugins for new deps | `expo-print` ships no `app.plugin.js`: nothing to add. `expo-sharing` and `expo-document-picker` ship plugins, but both are optional (sharing-intent and iCloud options, not used). `app.config.ts` unchanged | PASS (no change needed) |
| Android EAS development build | PENDING: awaiting owner approval (new native deps: expo-print, expo-sharing, expo-document-picker). No EAS command was run, no quota spent. Build id, APK link and result go here after approval. Profile development, account gia-terhubung | PENDING |

Until the new dev build exists, none of the device rows below can run: the M3 dev client (fd79f317) lacks the three native modules.

## 2. Android: Redmi 14C owner checklist

Install: the new development APK (section 1), then `cd apps/mobile && npx expo start --dev-client`, same Wi-Fi. Finish onboarding first; seed from Settings, Developer tools, DB check if you need many receipts.

| # | Check | Pass criterion | Status |
|---|---|---|---|
| R1 | Export a tax year as CSV, open in Google Sheets | columns correct, accents and non-Latin text intact, a merchant starting `=`, `+`, `-` or `@` shows as text (no formula runs) | OWNER-PENDING |
| R2 | Export a PDF report, open it | opens; receipt thumbnails visible; totals match the Folders tax-year screen | OWNER-PENDING |
| R3 | Share sheet, save to Files/Drive, return to the app | file saved; export screen state kept (range, format) | OWNER-PENDING |
| R4 | Lock timeout "Immediately": export, share, return | lock screen shows, then returns to the export screen | OWNER-PENDING |
| R5 | Backup with passphrase, Settings erase all local data, onboarding, restore with replace | receipts, images, folders, categories and home currency all back | OWNER-PENDING |
| R6 | Restore with a wrong passphrase | rejected with a clear message; nothing changed | OWNER-PENDING |
| R7 | Backup without passphrase | warning shown before the file is made | OWNER-PENDING |
| R8 | Merge-import a backup from a second device | receipts added; possible duplicates listed | OWNER-PENDING |
| R9 | Pick a non-backup file (PDF or photo) to restore | "not a My Expenses Book backup" message; no data change | OWNER-PENDING |
| R10 | Confirm 20 receipts, open Home | backup reminder banner appears; Later hides it | OWNER-PENDING |
| R11 | Proxy session (e.g. mitmproxy) during export and backup | only the FX host appears; no other host | OWNER-PENDING |

## 3. iOS: iPhone 12 Pro owner checklist

Needs a registered device build (`eas device:create`, owner step) or `npx expo run:ios --device`.

| # | Check | Pass criterion | Status |
|---|---|---|---|
| P1 | CSV export of a tax year, open in Numbers | columns correct, accents intact, no formula execution | OWNER-PENDING |
| P2 | PDF report | opens; thumbnails visible; totals match the Folders tax-year screen | OWNER-PENDING |
| P3 | Share sheet, save to Files, return to the app | file saved; screen state kept | OWNER-PENDING |
| P4 | Lock timeout "Immediately": export, share, return | lock screen shows, then returns to the export screen | OWNER-PENDING |
| P5 | Backup with passphrase, erase all data, onboarding, restore replace | receipts, images, folders, categories, home currency back | OWNER-PENDING |
| P6 | Wrong passphrase | rejected; nothing changed | OWNER-PENDING |
| P7 | Backup without passphrase | warning shown | OWNER-PENDING |
| P8 | Merge import from a second device | receipts added; possible duplicates listed | OWNER-PENDING |
| P9 | Pick a non-backup file | not-a-backup message; no data change | OWNER-PENDING |
| P10 | 20 confirmed receipts | reminder banner appears; Later hides it | OWNER-PENDING |
| P11 | Proxy session during export and backup | only the FX host | OWNER-PENDING |

## 4. Galaxy Z Flip 6 owner checklist

| # | Check | Pass criterion | Status |
|---|---|---|---|
| F1 | Export screen: pick a range and format, fold and unfold | selected range and format kept | OWNER-PENDING |
| F2 | Backup screen: type a passphrase, fold and unfold | typed passphrase kept | OWNER-PENDING |
| F3 | Export and backup screens on the cover screen and in landscape | content centered, max width 560, usable | OWNER-PENDING |
| F4 | Share sheet then fold/unfold, return | file still shared or saved; screen state kept | OWNER-PENDING |
| F5 | Lock timeout "Immediately" with fold/unfold on the export screen | lock shows once, returns to the export screen | OWNER-PENDING |

## 5. Carried forward

All OWNER-PENDING rows of `docs/m2-acceptance.md` and `docs/m3-acceptance.md` remain open.

## 6. Known follow-ups

See `docs/m4-followups.md`.

## 7. Summary

Host checks PASS (100 suites, 736 tests, tsc, check:pii, expo-doctor, Android prebuild compile check in a throwaway copy). Android EAS dev build PENDING owner approval (new native deps: expo-print, expo-sharing, expo-document-picker). All device rows OWNER-PENDING.
