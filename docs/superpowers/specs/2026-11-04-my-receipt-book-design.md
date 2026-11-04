# My Receipt Book — Design & Master Plan v2

## Context

The original `My Receipt Book Master Plan.md` (project root) has a solid stack but gaps: no backup story for a local-only app, no export, "smart parsing" hand-waved on top of raw OCR, scan-time conflated with purchase-time, FX at today's rate, RevenueCat contradicting "zero telemetry". This document replaces it as the source of truth after a co-founder/CTO review.

**Intent (owner's words, condensed):** portfolio/passion project now; may become indie side income later as users grow — keep the door open for a one-time **Pro unlock backed by Supabase**. Serve three users: travellers/expense claimers (multi-currency), freelancers doing taxes, households tracking spending/warranties (single default currency).

**Why it can win:** free scanners (Notes, Drive, Adobe Scan, Genius Scan) give you an image. My Receipt Book gives you a *structured, searchable, exportable receipt* — parsed by an on-device AI, never leaving the phone.

## Goals / Non-goals / Anti-goals

**Goals (v1)**
1. **Hero A — Smart parsing:** scan → merchant, purchase date/time, total, tax, currency, category pre-filled, user only confirms.
2. **Hero B — Organize & export:** folders/tax-year views with totals, CSV + PDF report export for claims and taxes.
3. 100% offline, no account, encrypted at rest, biometric lock.
4. Backup via user-owned export/import archive.
5. iOS + Android simultaneously. Languages: EN (default/fallback), ID, ES, PT-BR.

**Non-goals (v1)** — cloud sync, accounts, Pro unlock purchase, multi-device, OCR of non-receipt docs as a feature focus, budgets/analytics charts, bank integrations, web app.

**Anti-goals (failure even if it works)**
- Any network call carrying user data. Only allowed outbound calls: FX rate table download, store IAP.
- Any analytics/crash SDK that phones home by default.
- Parsing that silently saves wrong numbers (always a confirm step; low-confidence fields highlighted).
- Losing data on app update/migration.

## Product decisions

| Topic | Decision |
|---|---|
| Monetization v1 | Tip jar, 3 consumables: `tip_coffee_small` $2.99, `tip_coffee_standard` $4.99, `tip_coffee_generous` $9.99 |
| Monetization later | One-time non-consumable `pro_lifetime` → unlocks Supabase encrypted cloud backup/sync, sign-in with **Google (social sign-in)** via Supabase Auth. Owner: "yes cloud sync, but still can change". **Not built in v1**; architecture ready (see Sync readiness). |
| Currency | One **home currency** (set in onboarding, default from device locale). Every receipt stores its own ISO 4217 code. Foreign receipts show converted value. |
| FX rate | Rate **on purchase date**, frozen on the receipt (`fx_rate`, `fx_rate_date`, `amount_home_minor`). Editable / manual rate override always available. Weekly rate table cached; if purchase date lacks a rate, use nearest earlier cached rate and flag "approximate". |
| Home currency change | *My call:* re-convert all receipts at each one's purchase-date rate (fetch missing dates when online; else nearest cached, flagged approximate). Totals never mix currencies. |
| Tax year | *My call:* setting "tax year starts in [month]", default from locale (Jan for ID/US/most). Drives tax-year smart views and export range presets. |
| Parsing ship bar | Heuristic parser alone must get **total + purchase date correct on ≥85%** of a 50-receipt fixture set (mixed ID/EN/foreign). On-device AI is a bonus on top. |
| Foldables & large screens | **Supported in v1** (owner request): Samsung Galaxy Z Fold, Pixel Fold, Apple's foldable iPhone (when available), plus tablets/iPad. Adaptive layout, seamless fold/unfold, two-pane on wide screens. See "Adaptive layout". |
| Min OS | **iOS 16+, Android 8 (API 26)+.** On-device AI path only on iOS 26+ w/ Apple Intelligence and Gemini Nano Android devices; runtime capability check. |
| Time | Two separate fields: `purchased_at` (parsed from receipt, local wall-clock + IANA zone) and `scanned_at` (UTC ms + IANA zone of device). Sorting/grouping uses `purchased_at`. |
| Backup v1 | One-tap `.mrb` archive (zip: DB export + images + manifest). **Passphrase on by default, user may skip** with clear warning (no passphrase = plaintext in their cloud; forgotten passphrase = unrecoverable). Key derived via scrypt/Argon2 → AES-256-GCM. Delivered via share sheet → Files/iCloud Drive/Google Drive. Import restores (replace or merge by UUID). Gentle reminder after N new receipts since last backup. |
| Privacy | Biometric/passcode app lock; SQLCipher-encrypted DB; encrypted image files; no third-party telemetry SDKs. |
| Languages | EN, ID, ES, PT-BR — the usual startup v1 set (largest mobile app markets after EN; ID = home market). UI language ≠ receipt language: parser must handle any receipt language. |
| Categories | Fixed default set (Food & Drink, Transport, Lodging, Groceries, Shopping, Utilities, Health, Office, Entertainment, Other) + user-editable. |
| Folders | User folders (projects, trips) + automatic tax-year smart view. A receipt belongs to 0..1 folder; categories are separate. |

## Technical architecture

**Stack (kept from original unless noted)**
- Expo (latest SDK) + **Development Builds** (no Expo Go — native modules required), TypeScript strict, Expo Router.
- `expo-sqlite` with **SQLCipher** (config plugin `useSQLCipher: true`) + **Drizzle ORM** + drizzle-kit migrations (`useMigrations`). DB key: random 256-bit, stored in `expo-secure-store` (Keychain/Keystore).
- `react-native-mmkv` (encrypted instance) for prefs + FX table cache.
- Full-text search: **SQLite FTS5** virtual table over merchant, notes, raw OCR text; kept in sync by triggers.
- Scanner: `react-native-document-scanner-plugin` (VisionKit / ML Kit doc scanner, multi-page).
- OCR: **spike first** — `react-native-nitro-ocr` vs `@react-native-ml-kit/text-recognition`; pick the one that's maintained, returns line/block geometry, works with New Architecture. *(My call: decide in M0 by test on 20 real receipts.)*
- **Parsing (hybrid)** — custom local Expo module `modules/receipt-ai`:
  - iOS 26+ with Apple Intelligence: **Foundation Models** guided generation (`@Generable` Receipt struct) from OCR text.
  - Android with Gemini Nano: **ML Kit GenAI Prompt API**, JSON-schema prompt.
  - Fallback everywhere else: TypeScript heuristic parser (`src/parsing/heuristics/`) — amount/date/currency regexes, multilingual keyword tables (TOTAL/JUMLAH/TOTAL A PAGAR/SUMME…), largest-amount-near-total-keyword rule.
  - Common output: `ParsedReceipt { merchant, purchasedAt, timezone?, total, tax, currency, category, lineItems?, confidence per field }`. Validation layer (zod) rejects/normalizes LLM output; never trusts it blindly.
- Payments (owner-approved): **v1 = `expo-iap` only.** Store fully manages tips (Apple ID / Google account, payment, receipt email, refunds, tax, payouts); app just buys + finishes consumable. No server, privacy label stays "Data Not Collected". Sales history in App Store Connect (Sales and Trends) + Play Console (Order management). Enroll in Apple Small Business Program / Google 15% tier. **At Pro launch = replace `expo-iap` with RevenueCat** (never run both — transaction-listener conflicts), lazy-configured only on Pro/tip screens, `appUserID` = Supabase user id, webhook → Supabase sets `is_pro`. Keep purchase code behind `src/payments/` interface so the swap is local.
- Lock: `expo-local-authentication`; lock on cold start and after configurable background timeout.
- i18n: `i18next` + `react-i18next` + `expo-localization`; JSON bundles in `src/i18n/locales/{en,id,es,pt-BR}.json`; `Intl.NumberFormat` for money, `Intl.DateTimeFormat` for dates.
- Export: CSV (hand-rolled), PDF report via `expo-print` (HTML template → PDF, thumbnails embedded), share via `expo-sharing`. Archive via `react-native-zip-archive` + `expo-file-system`.
- Image encryption: AES-256-GCM via `react-native-quick-crypto`; originals encrypted at rest, decrypted to cache on view, small thumbnails also encrypted. Images downscaled/JPEG-compressed (~1600px long edge) before storage.
- Money: integer **minor units** (`amount_minor` + currency exponent from ISO table), never floats.
- Crash reporting: none in v1. Local error log viewable/exportable from Settings for user-initiated bug reports. *(My call.)*

**Data model (Drizzle, SQLite)** — sync-ready conventions on every table: `id` UUIDv7 text PK, `created_at`, `updated_at` (UTC ms), `deleted_at` (soft delete), `version` int.

- `receipts`: id, merchant, purchased_at_local (ISO wall-clock), purchased_tz (IANA, nullable), purchased_at_utc (ms, derived), scanned_at_utc, scanned_tz, currency, total_minor, tax_minor, fx_rate (text decimal), fx_rate_date, home_currency_at_save, amount_home_minor, fx_approximate bool, category_id, folder_id, notes, raw_ocr_text, parse_source (`apple_fm`|`gemini_nano`|`heuristic`|`manual`), parse_confidence json, status (`draft`|`confirmed`).
- `receipt_pages`: id, receipt_id, page_index, image_path, thumb_path, width, height.
- `line_items` (optional, LLM path only): id, receipt_id, description, qty, amount_minor.
- `categories`: id, name_key (i18n) or custom_name, icon, color, is_default.
- `folders`: id, name, kind (`project`|`trip`), default_currency nullable.
- `receipts_fts` (FTS5): merchant, notes, raw_ocr_text — content table + triggers.
- MMKV: `home_currency`, `language`, `lock_enabled`, `lock_timeout`, `fx_table` {base, fetched_at, rates by date}, `last_backup_at`, `receipts_since_backup`.

**FX source:** *my call:* single free no-key source covering 200+ currencies with historical-by-date files (e.g. fawazahmed0 `currency-api` on jsDelivr; Frankfurter/ECB only covers ~30 and misses VND, AED, TWD…). Single allowed host keeps privacy policy simple. Weekly fetch of latest; on-demand fetch of a specific historical date when online and user saves an old foreign receipt. Only currency codes + date go over the wire.

**Repo layout:** monorepo `My Receipt Book/` → `apps/mobile/` (Expo SDK 58), `apps/web/` (Next.js, later), `docs/`.

**Folder structure** (inside `apps/mobile/`; routes live in `src/app/` per Expo template)
```
src/app/
  _layout.tsx                 # providers: DB, i18n, lock gate, theme
  onboarding.tsx              # language, home currency, enable lock
  lock.tsx
  (tabs)/index.tsx            # feed grouped by month, totals in home currency, FAB scan
  (tabs)/search.tsx           # FTS5 search + filters (date range, category, folder, currency)
  (tabs)/folders.tsx          # folders + tax-year smart views, totals
  (tabs)/settings.tsx         # currency, language, lock, backup/restore, storage, tip jar, privacy, logs
  (modals)/scanner.tsx        # scan → OCR → parse → review
  (modals)/review/[id].tsx    # confirm parsed fields (low confidence highlighted)
  (modals)/export.tsx         # pick range/folder → CSV | PDF
  document/[id].tsx           # detail, pages viewer, edit, move, delete
modules/receipt-ai/           # Expo module: iOS FoundationModels, Android ML Kit GenAI
src/db/  (schema.ts, client.ts, migrations/, repositories/)
src/parsing/ (index.ts router, llm.ts, heuristics/, normalize.ts, schema.ts)
src/fx/  src/backup/  src/export/  src/crypto/  src/i18n/  src/components/  src/theme/
```

**Adaptive layout (foldables / tablets)**
- Window size classes from `useWindowDimensions()` (Material breakpoints): compact <600dp, medium 600–839dp, expanded ≥840dp. One hook `src/layout/useWindowClass.ts`; never branch on device model.
- **Compact** (folded cover screen, normal phones): current single-pane stack.
- **Medium/Expanded** (unfolded inner screen, tablets): **list–detail two-pane** — feed/search/folder list left, `document/[id]` right; tab bar becomes side rail. Review screen after scan shows image left, parsed fields right (big win for confirming numbers). Export/settings as centered max-width sheets.
- **Fold/unfold continuity:** no orientation lock; Android `resizeableActivity=true`, keep Expo's default `configChanges` (screenSize|screenLayout|orientation…) so the Activity isn't recreated; selected receipt, scroll position, and in-progress review form survive size change (state in URL params / store, not layout-local). Lock screen must not re-trigger on fold.
- Hinge/posture: *my call:* no posture-specific UI in v1 (tabletop mode etc.); two-pane split at 50% naturally aligns with the hinge on book-style folds. Revisit with Jetpack WindowManager module if needed.
- iOS: `supportsTablet: true`, iPad multitasking (no `requireFullScreen`); same breakpoints handle iPad Split View and a foldable iPhone's inner display.
- Charts/images use flexible sizing; touch targets ≥44pt; text scales with Dynamic Type / font scale.

**Sync readiness (for later Pro)** — UUIDv7 + updated_at + deleted_at + version everywhere; Drizzle schema mirrored to Supabase Postgres; images to Supabase Storage **client-side encrypted** (Supabase never sees plaintext); last-write-wins per row by `updated_at`. Supabase Auth (Google sign-in) only created when user buys Pro. **Key portability built in v1:** DB key and image key wrapped by a single master key, so later Pro can escrow the master key (wrapped by a user recovery passphrase) and restore on a new device. Nothing else of sync built in v1.

## Milestones (solo, part-time ≈ 10–12 weeks)

- **M0 — Spikes (wk 1):** dev build on both platforms; scanner plugin; OCR library bake-off on 20 real receipts (ID/EN/foreign); Foundation Models + Gemini Nano hello-world in `modules/receipt-ai`; SQLCipher + Drizzle + FTS5 open/migrate. Exit: go/no-go on each lib.
- **M1 — Foundation (wk 2–3):** project structure, theme, i18n (4 locales, EN complete, others machine-translated + reviewed later), onboarding, lock gate, DB schema + migrations + repositories, crypto key mgmt.
- **M2 — Capture & parse (wk 4–6):** scan → encrypt/store pages → OCR → hybrid parser → review screen; heuristic parser with fixture tests; FX fetch + frozen conversion.
- **M3 — Organize (wk 7–8):** feed with totals, detail/edit, folders, categories, tax-year views, FTS5 search + filters; `useWindowClass` + two-pane list–detail + side rail on medium/expanded. (Build screens adaptive from M1 onward — layout primitives in M1, two-pane wired here.)
- **M4 — Export & backup (wk 9):** CSV, PDF report, `.mrb` archive export/import (+ passphrase), backup reminder.
- **M5 — Polish & ship (wk 10–12):** tip jar via expo-iap, empty states, accessibility, store assets, privacy policy page, App Privacy "Data Not Collected" labels / Play Data Safety, EAS Build + Submit, TestFlight + Play internal testing.

**Slip policy (owner-chosen cut order):** 1) drop ES + PT-BR (ship EN + ID), 2) drop PDF export (CSV only), 3) defer on-device AI module to v1.1. Never cut: scan → heuristic parse → review, organize/search, encrypted storage, lock, backup/restore.

## Store prep (from original, updated)
Apple Developer ($99/yr), Play Console ($25). Consumable IAPs as above. Privacy policy (static page, e.g. GitHub Pages): no data collected; only outbound calls = FX rates + store purchases. Apple privacy label: Data Not Collected. Encryption export compliance: uses standard OS/AES encryption → declare exempt.

## Verification

- **Unit (Jest):** heuristic parser against a fixtures folder of ≥50 OCR text dumps with expected fields (accuracy report printed); money/minor-unit math; FX conversion incl. approximate fallback; timezone handling (travel case: scan in Paris, view in Jakarta → same local purchase time); CSV output.
- **DB:** migrations up from v1 fresh and from previous schema with seeded data; FTS triggers stay consistent on insert/update/soft delete.
- **Backup round-trip:** export → wipe app → import → byte-equal images, identical rows; wrong passphrase rejected.
- **Device E2E (Maestro):** onboarding → scan (fixture image injected) → review → save → search finds it → export CSV. Run on iOS simulator + Android emulator; parsing LLM path verified manually on a supported physical device of each OS.
- **Privacy check:** run app through proxy (Proxyman/Charles) for a full session — only FX host and store endpoints appear.
- **Foldables/large screens:** Android Studio foldable emulators (Pixel Fold, resizable emulator) — fold/unfold mid-review and mid-scan, verify no state loss and correct pane switch; Samsung Remote Test Lab on real Galaxy Z Fold; iPad simulator Split View sizes for iOS (and foldable iPhone simulator once Xcode ships one). Maestro flows run at compact + expanded sizes.
- **Pre-release:** EAS preview builds on TestFlight + Play internal track.

## Next steps after approval
1. `git init` the project root; save this doc as `docs/superpowers/specs/2026-11-04-my-receipt-book-design.md`; keep original master plan file for history.
2. Run superpowers:writing-plans to produce a task-level implementation plan for **M0 spikes + M1**, then execute milestone by milestone.

## Left to the builder
Exact UI/visual design, icon set, PDF report template layout, heuristic regex details, OCR library pick (per M0), Expo SDK version, state management for UI (React state + Drizzle live queries suggested).
