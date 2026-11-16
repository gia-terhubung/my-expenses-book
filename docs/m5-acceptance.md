# M5 acceptance: polish and ship

Date: 2026-11-16. Branch feat/m5-polish-ship. Status key: PASS / FAIL / OWNER-PENDING (needs a physical device or a store console) / PENDING (blocked on an owner decision or gate) / SKIPPED.

## 0. Gates (owner decision, 2026-11-16)

| # | Gate | Status |
|---|---|---|
| G1 | The EAS Android dev build is done, and every OWNER-PENDING row in `docs/m4-acceptance.md` is PASS. No store build runs before this. | PENDING |
| G2 | Placeholders replaced: `PRIVACY_POLICY_URL` (`apps/mobile/src/about/links.ts`), the `privacyPolicyUrl` / `supportUrl` fields in `apps/mobile/store.config.json`, `CONTACT_EMAIL` (`site/privacy/index.html`, `docs/store/play-listing.md`), and `ASC_APP_ID` (`apps/mobile/eas.json`). Check: `grep -rn "example.invalid\|CONTACT_EMAIL\|ASC_APP_ID" apps/mobile/src apps/mobile/eas.json apps/mobile/store.config.json site docs/store` returns nothing. | PENDING |
| G3 | The privacy page is published at that URL (not from `docs/`, which holds plans and follow-ups) | PENDING |
| G4 | The owner says go for the production builds and submit (they spend build quota and are outward-facing) | PENDING |

## 1. Automated checks (host, apps/mobile)

| Check | Result | Status |
|---|---|---|
| `npx jest` | Test Suites: 111 passed, 111 total. Tests: 831 passed, 831 total (after the final-review fix pass) | PASS |
| `npx tsc --noEmit` | no output, exit 0 | PASS |
| `npm run check:pii` | ok: 68 dump tokens checked against fixtures, none found | PASS |
| `npx expo lint` | 18 problems (4 errors, 14 warnings). The 4 errors were already on `main` before M5 (capture.tsx, BackupReminder.tsx x2, useWhenUnobscured.ts). New warnings: 2 `require()` calls inside `jest.mock` factories, the same pattern as existing tests | PASS (no new errors) |
| `npx expo-doctor` | 19/20, before and after M5. The one failing check (17 packages out of date) existed before M5 | PASS (unchanged) |
| Release bundle drops the dev screens | `npx expo export --platform android`: the dev seed string "Warung Kopi Contoh" is in the bundle before M5 (1) and absent after (0). The app control string `errorLog.v1` is present in both | PASS |
| `npx eas-cli metadata:lint` | "Store configuration is valid" (run with a temporary numeric `ascAppId`; the committed placeholder fails lint by design until G2) | PASS |
| `npx eas-cli config --profile production --platform android` | resolves: distribution store, autoIncrement, app-bundle | PASS |
| Privacy page self-contained | `grep -nE "https?://\|<script\|<link" site/privacy/index.html` returns no match | PASS |

## 2. Device checks (after G1; iPhone 12 Pro, Redmi 14C, Z Flip 6)

Tip purchases need store-installed builds. On iOS, use a sandbox Apple ID on a TestFlight or dev build. On Android, use a license-tester account on an internal-track install (Play Billing does not work on a sideloaded APK).

| # | Check | Pass criterion | Status |
|---|---|---|---|
| D1 | Tip jar, iOS sandbox: buy each of the three tiers | price from the store, thanks shown, no replay on the next open of Tip jar | OWNER-PENDING |
| D1b | Kill the app right after paying (before thanks), reopen Tip jar | the purchase is recovered on open: thanks shown once, finished (buying that tier again works) | OWNER-PENDING |
| D1c | Android: pay with a slow/pending test card ("Slow test card, approves after a few minutes") | "Your payment is pending…" shown; after approval, the next Tip jar open thanks and consumes it | OWNER-PENDING |
| D2 | Tip jar, Play license tester: buy each tier | same as D1; buying the same tier twice works (consumed) | OWNER-PENDING |
| D3 | Tip jar: cancel the purchase sheet | back to the tier list, no error text | OWNER-PENDING |
| D4 | Tip jar in airplane mode | "Tips aren't available right now…" with Try again; Try again works once online | OWNER-PENDING |
| D5 | Proxy session (Proxyman/Charles): onboarding, scan, save, search, export, backup, Tip jar | iOS: only `cdn.jsdelivr.net` plus Apple store endpoints, with store requests only after Tip jar opens. Android: the same, plus Google ML Kit / Play services hosts. Record every ML Kit host and payload type, then confirm that `docs/store/privacy-answers.md` and the policy match | OWNER-PENDING |
| D5b | Owner decision: Android ML Kit diagnostics vs the spec anti-goal "any analytics/crash SDK that phones home by default" | accept and disclose (current docs), or replace the Android OCR/scanner/AI path | PENDING |
| D6 | VoiceOver (iPhone): feed, review, save (with an empty total first), search, export | every control is announced with a role; the blocked save announces "Enter the total."; folder rows say "Trip, …" / "Project, …"; swatches say color names | OWNER-PENDING |
| D7 | TalkBack (Redmi): same flow as D6 | same as D6 | OWNER-PENDING |
| D8 | Largest font size, both OSes: feed, review, settings, tip jar | no clipped totals, labels or buttons | OWNER-PENDING |
| D9 | Z Flip 6: fold and unfold on the feed (empty and full) and on Tip jar | no state loss; the empty feed shows "Scan a receipt" / "Add manually" | OWNER-PENDING |
| D10 | Manual end-to-end (plan call C5): onboarding, scan, review, save, search finds it, export CSV | completes on both OSes | OWNER-PENDING |
| D11 | Settings: Storage row, Error log (trigger one: open a corrupted backup), Export log, Clear log, Privacy policy link | values shown; the log shares a `.txt`; the link opens the published policy | OWNER-PENDING |
| D12 | Release build has no Developer tools section and no `/db-check` deep link | `myexpensesbook://db-check` lands on the feed | OWNER-PENDING |

## 3. Store consoles (owner)

| # | Task | Source | Status |
|---|---|---|---|
| S1 | Create the consumables `tip_coffee_small` ($2.99), `tip_coffee_standard` ($4.99), `tip_coffee_generous` ($9.99) in App Store Connect and Play Console | spec "Monetization v1" | OWNER-PENDING |
| S2 | Apple Small Business Program and Play 15% service-fee tier | spec "Payments" | OWNER-PENDING |
| S3 | App Privacy ("Data Not Collected"), Data safety, content rating, target audience, ads, financial features | `docs/store/privacy-answers.md` | OWNER-PENDING |
| S4 | Listing text: App Store via `eas metadata:push`; Play pasted in by hand | `apps/mobile/store.config.json`, `docs/store/play-listing.md` | OWNER-PENDING |
| S5 | Screenshots, Play feature graphic, 512 icon | `docs/store/assets.md` | OWNER-PENDING |
| S6 | Play service-account key at `apps/mobile/secrets/play-service-account.json` (gitignored) | `eas.json` submit profile | OWNER-PENDING |

## 4. Builds and submit (only after G1–G4)

| Step | Command (in apps/mobile) | Result | Status |
|---|---|---|---|
| B1 | `npx eas-cli@latest build --profile production --platform all` | build ids: | PENDING |
| B2 | `npx eas-cli@latest submit --profile production --platform ios --latest` | TestFlight processing | PENDING |
| B3 | `npx eas-cli@latest submit --profile production --platform android --latest` | Play internal track release | PENDING |
