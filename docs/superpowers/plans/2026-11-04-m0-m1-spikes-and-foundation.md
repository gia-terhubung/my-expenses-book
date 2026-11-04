# My Expenses Book — M0 Spikes + M1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the risky native libraries on both platforms (M0), then ship a running, encrypted, localized, lockable, adaptive app shell with the full v1 data layer (M1) — ready for M2 capture & parse.

**Repo layout:** monorepo `My Expenses Book/` — `apps/mobile/` (this plan), `apps/web/` (Next.js, later), `docs/` at root. **All file paths and commands in this plan are relative to `apps/mobile/` unless they start with `docs/`.** Each app keeps its own `package.json`; add workspaces only when `apps/web` lands and shares code.

**Architecture:** Expo dev-build app (Expo SDK 58, React Native 0.88), Expo Router routes in `src/app/` (template default), all non-route logic in `src/` by responsibility. Pure logic (crypto derivation, money, schema/repositories, i18n resolution, window classes) is tested in Node with Jest; native behaviour is verified on simulators/emulators with written checklists. DB = SQLCipher `expo-sqlite` + Drizzle; repositories accept a generic sync SQLite Drizzle DB so tests run them on `better-sqlite3`.

**Tech Stack:** Expo SDK 58, TypeScript strict, Expo Router, expo-sqlite (SQLCipher), drizzle-orm + drizzle-kit, better-sqlite3 (tests only), react-native-mmkv, expo-secure-store, react-native-quick-crypto, uuidv7, i18next + react-i18next + expo-localization, expo-local-authentication, react-native-document-scanner-plugin, Jest (jest-expo) + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-11-04-my-expenses-book-design.md`

## Global Constraints

- Min OS: iOS 16+ (deployment target = max(16.0, Expo SDK minimum)), Android 8 / API 26 (`minSdkVersion 26`).
- Add packages with `npx expo install <pkg>` (SDK-compatible versions). Follow `apps/mobile/AGENTS.md` (check versioned docs `https://docs.expo.dev/versions/v58.0.0/` before using any Expo API).
- Dev builds only (no Expo Go). Run with `npx expo run:ios` / `npx expo run:android`.
- No analytics/crash/telemetry SDKs. No network calls in M0/M1 code paths.
- Every table: `id` text PK (UUIDv7 via `uuidv7` package, except seeded defaults), `created_at`, `updated_at` (UTC ms integers), `deleted_at` (nullable ms), `version` integer starting 1.
- Money stored as integer minor units; never floats.
- Languages: `en` (default/fallback), `id`, `es`, `pt-BR`.
- Window classes: compact <600dp, medium 600–839dp, expanded ≥840dp. Never branch on device model.
- No orientation lock; Android `resizeableActivity=true`; iOS `supportsTablet: true`, no `requireFullScreen`.
- Android `allowBackup=false` *(builder's call: OS backup would restore an encrypted DB without its Keystore key → unreadable; spec chose app-level `.meb` backup instead)*.
- Bundle id / package: `com.terhubung.myexpensesbook` *(placeholder — confirm before store submission)*.
- TypeScript `strict: true`; path alias `@/*` → `src/*`.

## Review Focus

1. **Fold/unfold or rotation during onboarding, lock screen, or settings** → layout switches, no state loss, lock prompt not re-triggered. Test: Task 12 `useLockGate` test "dimension change does not lock"; Task 13 onboarding step stored in prefs.
2. **Biometrics unavailable or not enrolled** → lock toggle disabled with explanation; device passcode fallback allowed; user never locked out. Test: Task 12 "no hardware → cannot enable".
3. **DB exists but key missing/wrong** (keychain wiped, restore from another device) → explicit "can't unlock data" screen; never silently create a fresh DB over the old file. Test: Task 8 `openDatabase` throws `DbKeyMismatchError` on wrong key.
4. **Unsupported device locale** (e.g. `fr-FR`, `pt-PT`, locale without region) → UI falls back to `en` (`pt-*` → `pt-BR`); home currency from locale currency, else `USD`. Test: Task 9 resolver tests.
5. **App upgrade with existing data** → migrations apply without data loss; FTS stays consistent with soft-deletes. Test: Task 7 migration-on-seeded-DB + FTS trigger tests.

---

## M0 — Spikes

### Task 1: Scaffold the app and get dev builds running on both platforms

**Files:**
- Already done: `apps/mobile/` scaffolded with `create-expo-app@latest --template default` (SDK 58, routes in `src/app/`, `strict` + `@/*` alias already set, deps not installed).
- Modify: `app.json` → `app.config.ts`, `package.json`, `src/app/*` (reset)
- Create: `jest.config.js`, `src/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` (Jest, two projects: `node` for `src/**/*.test.ts`, `jest-expo` for `*.test.tsx`), `npm run typecheck` (`tsc --noEmit`), `@/*` alias.

- [ ] **Step 1:** `npm install`, then `npm run reset-project` (drop example screens; delete the `example/` dir it creates). Remove web-only template bits not needed (`web.output: server` stays harmless; leave it).
- [ ] **Step 2:** Convert to `app.config.ts` with: name "My Expenses Book", slug `my-expenses-book`, scheme `myexpensesbook`, `ios.bundleIdentifier` / `android.package` = `com.terhubung.myexpensesbook`, `ios.supportsTablet: true`, `orientation: "default"`, `android.allowBackup: false`, plugin `expo-build-properties` with `android.minSdkVersion: 26` and `ios.deploymentTarget` per Global Constraints.
- [ ] **Step 3:** Add scripts `typecheck`, `test`. Configure Jest with two projects (node + jest-expo).
- [ ] **Step 4:** Write `src/smoke.test.ts` asserting `1 + 1 === 2`; run `npm test` → PASS; `npm run typecheck` → no errors.
- [ ] **Step 5:** `npx expo prebuild --clean` then `npx expo run:ios` and `npx expo run:android` → blank home screen renders on iOS simulator and Android emulator. Confirm `android/app/src/main/AndroidManifest.xml` has `android:allowBackup="false"` and `resizeableActivity` not false.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "chore: scaffold Expo app with dev builds and Jest"`

### Task 2: Spike — scanner + OCR library bake-off

Throwaway code under `src/app/(dev)/` (only reachable when `__DEV__`). Needs **20 real receipt photos** from the owner (mix ID / EN / foreign), placed in `spikes/receipts/` (gitignored).

**Files:**
- Create: `src/app/(dev)/scan-spike.tsx`, `docs/spikes/2026-11-ocr-bakeoff.md`

- [ ] **Step 1:** Install `react-native-document-scanner-plugin`, `react-native-nitro-ocr`, `@react-native-ml-kit/text-recognition`; rebuild both platforms.
- [ ] **Step 2:** Build the spike screen: "Scan" button → scanner (multi-page) → shows pages; "Pick image" (from `spikes/receipts/` copied to simulator photos) → run both OCR libs, show raw text + elapsed ms side by side, "Copy text" button.
- [ ] **Step 3:** Run all 20 receipts through both libs on iOS simulator + Android emulator. Save each OCR text dump to `spikes/ocr-dumps/<lib>/<n>.txt` — these become the seed of M2's parser fixtures.
- [ ] **Step 4:** Record in `docs/spikes/2026-11-ocr-bakeoff.md`: per lib — builds on New Architecture (y/n), last release date, returns line/block geometry (y/n), avg ms, subjective accuracy on totals/dates (n/20), Indonesian text quality. **Decision** line: chosen OCR lib. Scanner plugin: multi-page works on both (y/n).
- [ ] **Step 5:** Remove the losing OCR lib from `package.json`. **Commit** — `git commit -am "spike: scanner + OCR bake-off, choose <lib>"`

### Task 3: Spike — `modules/receipt-ai` on-device LLM availability + hello-world parse

**Files:**
- Create: `modules/receipt-ai/` (via `npx create-expo-module@latest --local receipt-ai`), `src/app/(dev)/ai-spike.tsx`, `docs/spikes/2026-11-receipt-ai.md`

**Interfaces:**
- Produces (kept for M2): `ReceiptAI.getAvailability(): Promise<{ available: boolean; engine: 'apple_fm' | 'gemini_nano' | null; reason?: string }>` and `ReceiptAI.parseReceipt(ocrText: string, hints: { locale: string; homeCurrency: string }): Promise<string>` (JSON string, validated in JS later).

- [ ] **Step 1:** iOS (Swift): `getAvailability` checks `if #available(iOS 26, *)` then `SystemLanguageModel.default.availability`; `parseReceipt` uses a `@Generable struct Receipt { merchant, purchasedAt (ISO string), total (string decimal), tax, currency (ISO 4217) }` with `LanguageModelSession().respond(to:generating:)`, returns encoded JSON. Older iOS → `available: false, reason: "os"`.
- [ ] **Step 2:** Android (Kotlin): ML Kit GenAI Prompt API — check feature status (available / downloadable / unavailable); `parseReceipt` prompts with the same JSON schema and returns the text. Unsupported device → `available: false, reason: "device"`.
- [ ] **Step 3:** Spike screen: shows availability; paste OCR dump → Parse → shows JSON + elapsed ms.
- [ ] **Step 4:** Verify on: iOS 26 simulator (Apple Intelligence-capable Mac host) and, if owner has one, a Gemini Nano Android device; emulator must report unavailable gracefully (no crash). Run 5 OCR dumps from Task 2.
- [ ] **Step 5:** Record in `docs/spikes/2026-11-receipt-ai.md`: works per platform (y/n), latency, accuracy on 5 dumps, model-download behaviour, gotchas. **Decision**: go / defer to v1.1 (slip policy item 3).
- [ ] **Step 6: Commit** — `git commit -am "spike: receipt-ai module availability and parse"`

### Task 4: Spike — SQLCipher + FTS5 on device

**Files:**
- Create: `src/app/(dev)/db-spike.tsx`, `docs/spikes/2026-11-sqlcipher.md`

- [ ] **Step 1:** Add `["expo-sqlite", { "useSQLCipher": true }]` to plugins; rebuild.
- [ ] **Step 2:** Spike screen: open `spike.db`, `PRAGMA key = "x'<64 hex>'"`, run `PRAGMA cipher_version` (expect non-empty), create FTS5 table, insert, `MATCH` query; close, reopen with wrong key → expect `file is not a database` error on first read.
- [ ] **Step 3:** Pull the db file from the simulator and confirm `sqlite3 spike.db .tables` fails (encrypted).
- [ ] **Step 4:** Record results + exact error string for wrong key in `docs/spikes/2026-11-sqlcipher.md` (Task 8 matches on it). **Commit** — `git commit -am "spike: verify SQLCipher and FTS5 on device"`

**M0 exit gate:** all three spike docs have a Decision line; owner reviews before M1.

---

## M1 — Foundation

### Task 5: Key management (`src/crypto/`)

**Files:**
- Create: `src/crypto/keys.ts`, `src/crypto/secureStore.ts`, `src/crypto/keys.test.ts`
- Modify: `jest.config.js` (node project: `moduleNameMapper` `react-native-quick-crypto` → `crypto`)

**Interfaces:**
- Produces:
  - `type KeyPurpose = 'db' | 'images' | 'prefs'`
  - `interface SecretStore { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void> }`
  - `getOrCreateMasterKey(store: SecretStore): Promise<Uint8Array>` — 32 random bytes, stored hex under `meb.masterKey.v1`.
  - `deriveKey(master: Uint8Array, purpose: KeyPurpose): Uint8Array` — HKDF-SHA256, salt empty, info `meb-<purpose>-v1`, length 32 (`prefs`: 16, MMKV key limit).
  - `toHex(b: Uint8Array): string`
  - `expoSecretStore: SecretStore` (wraps `expo-secure-store`, `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY`).
- Design note *(builder's call implementing spec's "wrapped by a single master key")*: subkeys are HKDF-derived from the master, so escrowing the master later restores all keys.

- [ ] **Step 1: Write failing tests** in `keys.test.ts` with an in-memory `SecretStore`:
  - `getOrCreateMasterKey` returns 32 bytes; second call returns identical bytes; store holds 64 hex chars under `meb.masterKey.v1`.
  - `deriveKey(m,'db')` deterministic, 32 bytes; `deriveKey(m,'db') ≠ deriveKey(m,'images')`; `deriveKey(m,'prefs').length === 16`.
  - Known-answer: master = 32 bytes of `0x01` → `toHex(deriveKey(m,'db'))` equals value computed once with Node `crypto.hkdfSync('sha256', m, Buffer.alloc(0), 'meb-db-v1', 32)` (assert against `hkdfSync` directly).
- [ ] **Step 2:** `npm test -- src/crypto` → FAIL (module not found).
- [ ] **Step 3:** Implement with `react-native-quick-crypto` (`randomBytes`, `hkdfSync`); install `react-native-quick-crypto`, `expo-secure-store`; call quick-crypto `install()` in `src/app/_layout.tsx` top so `crypto.getRandomValues` exists for `uuidv7`.
- [ ] **Step 4:** `npm test -- src/crypto` → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(crypto): master key + HKDF subkeys"`

### Task 6: Money + currency table (`src/money/`)

**Files:**
- Create: `src/money/currencies.ts`, `src/money/money.ts`, `src/money/money.test.ts`

**Interfaces:**
- Produces:
  - `CURRENCIES: ReadonlyArray<{ code: string; exponent: number }>` — full ISO 4217 active list (e.g. `USD` 2, `IDR` 2 per ISO, `JPY` 0, `KWD` 3, `VND` 0).
  - `currencyExponent(code: string): number` — throws `UnknownCurrencyError` for unknown codes.
  - `toMinor(decimal: string, code: string): number` — parses `"12.34"` / `"12"`; rejects >exponent fraction digits by rounding half-up; no float math (string arithmetic).
  - `fromMinor(minor: number, code: string): string` — `1234,'USD'` → `"12.34"`.
  - `formatMoney(minor: number, code: string, locale: string): string` — `Intl.NumberFormat(locale,{style:'currency',currency:code})`.

- [ ] **Step 1: Write failing tests:** `toMinor('12.34','USD')===1234`; `toMinor('1500','JPY')===1500`; `toMinor('1.2345','KWD')===1235`; `toMinor('0.1','USD')===10`; `fromMinor(5,'USD')==='0.05'`; `fromMinor(1500,'JPY')==='1500'`; `currencyExponent('XXX')` throws `UnknownCurrencyError`; `formatMoney(1234,'EUR','de-DE')` contains `12,34`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(money): ISO 4217 table and minor-unit conversion"`

### Task 7: Schema, migrations, FTS, repositories (`src/db/`)

**Files:**
- Create: `src/db/schema.ts`, `src/db/ids.ts`, `src/db/types.ts`, `drizzle.config.ts`, `src/db/migrations/*` (generated), `src/db/migrations/0001_fts.sql` (custom), `src/db/repositories/{categories,folders,receipts}.ts`, `src/db/testing/testDb.ts`, `src/db/repositories/*.test.ts`, `src/db/migrations.test.ts`
- Modify: `babel.config.js` (`babel-plugin-inline-import` for `.sql`), `metro.config.js` (`sourceExts` add `sql`)

**Interfaces:**
- Consumes: none (pure).
- Produces:
  - `type AppDb = BaseSQLiteDatabase<'sync', any, typeof schema>` in `types.ts`.
  - `newId(): string` (UUIDv7), `now(): number`.
  - Tables in `schema.ts` exactly per spec Data model: `receipts`, `receiptPages` (`receipt_pages`), `lineItems` (`line_items`), `categories`, `folders`. Column names snake_case as in spec; timestamps integer ms; booleans `integer({mode:'boolean'})`; `parse_confidence` text JSON; enums as text with TS unions: `ParseSource = 'apple_fm'|'gemini_nano'|'heuristic'|'manual'`, `ReceiptStatus = 'draft'|'confirmed'`, `FolderKind = 'project'|'trip'`. Indexes: `receipts(purchased_at_utc)`, `receipts(folder_id)`, `receipts(category_id)`, `receipt_pages(receipt_id)`.
  - Default categories seeded **in a migration** with fixed ids `default:food_drink`, `default:transport`, `default:lodging`, `default:groceries`, `default:shopping`, `default:utilities`, `default:health`, `default:office`, `default:entertainment`, `default:other` (`name_key` = suffix, `is_default` true) *(builder's call: stable ids so future sync merges defaults across devices)*.
  - FTS: `receipts_fts` FTS5 `(merchant, notes, raw_ocr_text, content='receipts', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2')` + AFTER INSERT/UPDATE/DELETE triggers.
  - Repositories (all take `db: AppDb` first; every update sets `updated_at=now()` and `version=version+1`; deletes are soft):
    - `listCategories(db): Category[]` (non-deleted, defaults first)
    - `createFolder(db, {name, kind, defaultCurrency?}): Folder`, `listFolders(db)`, `renameFolder(db, id, name)`, `softDeleteFolder(db, id)` (also nulls `folder_id` on its receipts)
    - `createReceipt(db, input: NewReceiptInput): Receipt` (status defaults `draft`), `getReceipt(db, id): Receipt | null` (null if soft-deleted), `updateReceipt(db, id, patch: Partial<NewReceiptInput>): Receipt`, `softDeleteReceipt(db, id)`, `searchReceipts(db, query: string): Receipt[]` (FTS MATCH, prefix match per token, excludes soft-deleted, ordered by `purchased_at_utc` desc)
  - `testDb(): AppDb` — `better-sqlite3` `:memory:` + Drizzle + `migrate(…, {migrationsFolder})`.

- [ ] **Step 1:** Install `drizzle-orm`, `uuidv7`; dev: `drizzle-kit`, `better-sqlite3`, `@types/better-sqlite3`, `babel-plugin-inline-import`. `drizzle.config.ts`: `dialect: 'sqlite'`, `driver: 'expo'`, `schema: './src/db/schema.ts'`, `out: './src/db/migrations'`.
- [ ] **Step 2: Write failing tests:**
  - `receipts.test.ts`: create → get returns same fields, `version 1`, `status 'draft'`; update bumps `version` to 2 and `updated_at` increases; softDelete → `getReceipt` null; `searchReceipts('indom')` finds merchant "Indomaret"; search finds text only in `raw_ocr_text`; search for "cafe" matches "Café"; soft-deleted receipt not returned by search; after updating merchant, old merchant no longer matches.
  - `categories.test.ts`: fresh DB lists exactly 10 defaults with the ids above.
  - `folders.test.ts`: softDeleteFolder sets `folder_id` null on its receipts.
  - `migrations.test.ts` (Review Focus 5): apply migrations up to N-1 (all but last), insert a receipt with raw SQL, apply remaining, assert row intact and searchable. (When only one migration exists, test re-running `migrate` on a seeded DB is a no-op and keeps data.)
- [ ] **Step 3:** Run `npm test -- src/db` → FAIL.
- [ ] **Step 4:** Write `schema.ts`; `npx drizzle-kit generate`; `npx drizzle-kit generate --custom --name=fts` and fill with FTS table, triggers, `INSERT INTO receipts_fts(receipts_fts) VALUES('rebuild')`, and the category seed inserts. Implement repositories and `testDb`.
- [ ] **Step 5:** Run → PASS. `npm run typecheck` → clean.
- [ ] **Step 6: Commit** — `git commit -am "feat(db): schema, FTS5, migrations, repositories"`

### Task 8: Encrypted DB on device + provider

**Files:**
- Create: `src/db/client.ts`, `src/db/DatabaseProvider.tsx`, `src/db/client.test.ts`, `src/app/db-error.tsx`

**Interfaces:**
- Consumes: `getOrCreateMasterKey`, `deriveKey`, `toHex`, `expoSecretStore` (Task 5); schema + migrations (Task 7).
- Produces:
  - `class DbKeyMismatchError extends Error`
  - `openDatabase(opts: { name?: string /* default 'meb.db' */; keyHex: string; open?: (name: string) => SQLiteDatabase }): AppDb` — runs `PRAGMA key = "x'<keyHex>'"` first statement, then `SELECT count(*) FROM sqlite_master`; on the wrong-key error string recorded in `docs/spikes/2026-11-sqlcipher.md` throws `DbKeyMismatchError`. Never deletes or recreates the file.
  - `<DatabaseProvider>` — derives key, opens, runs `useMigrations`; renders children when ready; on `DbKeyMismatchError` routes to `src/app/db-error.tsx` ("Your data can't be unlocked on this device. Restore from a backup or reset."; reset requires typing `RESET`); `useDb(): AppDb`.

- [ ] **Step 1: Write failing test** `client.test.ts` with an injected fake `open` whose `execSync`/`getFirstSync` throws the recorded wrong-key error after `PRAGMA key` → `openDatabase` throws `DbKeyMismatchError`; with a fake that succeeds → returns a DB and the first executed statement is exactly `PRAGMA key = "x'<keyHex>'"`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Device check:** wrap `src/app/_layout.tsx` in `DatabaseProvider`; launch on iOS + Android; on a `(dev)` button create + read back a receipt. Then change the info string locally to simulate a different key → `db-error` screen appears, file untouched. Revert.
- [ ] **Step 6: Commit** — `git commit -am "feat(db): SQLCipher client, provider, key-mismatch screen"`

### Task 9: Preferences + i18n (`src/prefs/`, `src/i18n/`)

**Files:**
- Create: `src/prefs/prefs.ts`, `src/prefs/prefs.test.ts`, `src/i18n/index.ts`, `src/i18n/resolve.ts`, `src/i18n/resolve.test.ts`, `src/i18n/locales/{en,id,es,pt-BR}.json`, `src/i18n/locales.test.ts`

**Interfaces:**
- Consumes: `deriveKey(master,'prefs')` (Task 5) as MMKV `encryptionKey`.
- Produces:
  - `type Language = 'en'|'id'|'es'|'pt-BR'`; `type LockTimeout = 0 | 60 | 300 | 900` (seconds; default 60 — builder's call).
  - `interface Prefs { homeCurrency: string|null; language: Language|null; lockEnabled: boolean; lockTimeout: LockTimeout; onboardingStep: 'language'|'currency'|'lock'|'done'; lastBackupAt: number|null; receiptsSinceBackup: number; taxYearStartMonth: number /*1–12*/ }` (FX keys added in M2).
  - `createPrefs(storage: KV): { get<K extends keyof Prefs>(k: K): Prefs[K]; set<K>(k: K, v: Prefs[K]): void; subscribe(k, cb): () => void }`, `usePref(k)` hook. `KV` = minimal `{getString, set, delete}` so tests use a Map; app wraps encrypted MMKV.
  - `resolveLanguage(deviceLocales: {languageTag: string; languageCode: string|null}[]): Language` — first match of exact tag, then `pt*`→`pt-BR`, `in`/`id`→`id`, `es*`→`es`, `en*`→`en`; none → `en`.
  - `resolveHomeCurrency(deviceLocales: {currencyCode: string|null}[]): string` — first valid ISO code (checked with `currencyExponent`), else `USD`.
  - `defaultTaxYearStartMonth(regionCode: string|null): number` — `GB`→4, `AU`→7, `NZ`→4, `IN`→4, else 1.
  - `initI18n(lang: Language): void` — i18next, `fallbackLng: 'en'`, resources bundled.
  - Translation key namespaces: `common.*`, `tabs.*`, `onboarding.*`, `lock.*`, `settings.*`, `dbError.*`, `categories.<name_key>`.

- [ ] **Step 1: Write failing tests:**
  - `resolveLanguage([{languageTag:'fr-FR',languageCode:'fr'}])==='en'`; `pt-PT`→`pt-BR`; `id-ID`→`id`; `es-MX`→`es`; `[]`→`en`.
  - `resolveHomeCurrency([{currencyCode:null}])==='USD'`; `[{currencyCode:'IDR'}]`→`IDR`; `[{currencyCode:'ZZZ'}]`→`USD`.
  - `defaultTaxYearStartMonth('GB')===4`, `('ID')===1`, `(null)===1`.
  - prefs: unset `onboardingStep` returns `'language'`, `lockTimeout` returns `60`; set/get round-trip; subscribe fires on set.
  - `locales.test.ts`: every key in `en.json` exists in `id`, `es`, `pt-BR` (flattened key sets equal); no empty strings in `en`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; write full EN strings; ID/ES/PT-BR machine-translated (spec: reviewed later). **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat: encrypted prefs and i18n with locale resolution"`

### Task 10: Theme + adaptive layout primitives (`src/theme/`, `src/layout/`)

**Files:**
- Create: `src/theme/tokens.ts`, `src/theme/ThemeProvider.tsx`, `src/layout/windowClass.ts`, `src/layout/useWindowClass.ts`, `src/layout/TwoPane.tsx`, `src/layout/windowClass.test.ts`, `src/layout/TwoPane.test.tsx`

**Interfaces:**
- Produces:
  - `type WindowClass = 'compact'|'medium'|'expanded'`; `windowClassFor(widthDp: number): WindowClass` (<600, 600–839, ≥840).
  - `useWindowClass(): WindowClass` (from `useWindowDimensions().width`).
  - `<TwoPane primary={ReactNode} secondary={ReactNode|null} />` — compact: renders only `secondary ?? primary`; medium/expanded: side-by-side 50/50 (expanded: primary 40% max 420dp *(builder may tune)*), empty secondary shows placeholder slot.
  - `tokens` light/dark (color, spacing 4-pt scale, radius, type scale honoring font scale), `useTheme()`; follows system color scheme.

- [ ] **Step 1: Write failing tests:** `windowClassFor(599)==='compact'`, `(600)==='medium'`, `(839)==='medium'`, `(840)==='expanded'`. `TwoPane` with mocked width 400 renders only secondary when given; width 900 renders both (query by testID `pane-primary`, `pane-secondary`).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(layout): window classes, TwoPane, theme tokens"`

### Task 11: Navigation shell (tabs ↔ side rail, placeholder screens)

**Files:**
- Modify: `src/app/_layout.tsx` (providers order: quick-crypto install → Theme → Database → i18n → Stack; Task 12 inserts LockGate after i18n)
- Create: `src/app/(tabs)/_layout.tsx`, `src/app/(tabs)/{index,search,folders,settings}.tsx` (placeholders with translated titles + empty states), `src/app/document/[id].tsx` (placeholder), `src/layout/SideRail.tsx`, `src/app/(tabs)/_layout.test.tsx`

**Interfaces:**
- Consumes: `useWindowClass`, `TwoPane`, `useTheme`, `useTranslation`.
- Produces: tab route names `index`, `search`, `folders`, `settings` (M3 fills them); `document/[id]` route.

- [ ] **Step 1: Write failing test:** with width 400 the tabs layout renders the bottom tab bar (testID `tab-bar`); width 900 renders `SideRail` (testID `side-rail`) and no `tab-bar`; both show the 4 translated labels.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement — use Expo Router `Tabs` with custom `tabBar` that returns `null` on medium/expanded while `SideRail` renders beside the content. **Step 4:** Run → PASS.
- [ ] **Step 5: Device check:** Android Studio Pixel Fold emulator: fold/unfold while on Settings tab → stays on Settings, rail↔tabs switch, no remount flash of other screens. iPad simulator Split View 1/3 ↔ 2/3.
- [ ] **Step 6: Commit** — `git commit -am "feat(nav): adaptive tab bar / side rail shell"`

### Task 12: App lock (`src/lock/`)

**Files:**
- Create: `src/lock/lockPolicy.ts`, `src/lock/lockPolicy.test.ts`, `src/lock/useLockGate.ts`, `src/lock/useLockGate.test.tsx`, `src/lock/LockGate.tsx`, `src/app/lock.tsx`

**Interfaces:**
- Consumes: `usePref('lockEnabled')`, `usePref('lockTimeout')` (Task 9).
- Produces:
  - `shouldLock(state: { lockEnabled: boolean; lastBackgroundAt: number|null; now: number; timeoutSec: LockTimeout; coldStart: boolean }): boolean` — true if enabled and (coldStart or `now - lastBackgroundAt >= timeoutSec*1000`); `timeoutSec 0` locks on any background→active.
  - `canEnableLock(): Promise<{ ok: boolean; reason?: 'no_hardware'|'not_enrolled' }>` — `expo-local-authentication` `hasHardwareAsync` / `isEnrolledAsync`; device passcode counts (`disableDeviceFallback: false`).
  - `useLockGate(): { locked: boolean; unlock(): Promise<boolean> }` — reacts only to `AppState` `background`→`active`; ignores `inactive` and dimension changes.
  - `<LockGate>` renders `src/app/lock.tsx` content over children while locked (children stay mounted → no state loss).
- Add `NSFaceIDUsageDescription` via `expo-local-authentication` plugin config.

- [ ] **Step 1: Write failing tests:** `shouldLock` — disabled → false; coldStart+enabled → true; backgrounded 30s with timeout 60 → false; 60s → true; timeout 0 after 1ms → true. `useLockGate` (mock `AppState`, `useWindowDimensions`): changing dimensions does not lock; `inactive`→`active` does not lock; `background` 61s →`active` locks. `canEnableLock` with `hasHardwareAsync` false → `{ok:false, reason:'no_hardware'}`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Device check:** enable lock, background 2 min, return → prompt; Face ID simulator "Non-matching" → stays locked with Retry; fold/unfold on Pixel Fold emulator → no prompt.
- [ ] **Step 6: Commit** — `git commit -am "feat(lock): biometric app lock with timeout policy"`

### Task 13: Onboarding + basic Settings rows

**Files:**
- Create: `src/app/onboarding.tsx`, `src/onboarding/steps.ts`, `src/onboarding/steps.test.ts`, `src/components/{LanguagePicker,CurrencyPicker,LockToggle,TaxYearPicker}.tsx`
- Modify: `src/app/_layout.tsx` (redirect to `/onboarding` when `onboardingStep !== 'done'`), `src/app/(tabs)/settings.tsx` (rows: Language, Home currency, Tax year starts, App lock + timeout — reuse the pickers)

**Interfaces:**
- Consumes: prefs, `resolveLanguage`, `resolveHomeCurrency`, `defaultTaxYearStartMonth`, `CURRENCIES`, `canEnableLock`, `initI18n`.
- Produces: `nextStep(step: Prefs['onboardingStep']): Prefs['onboardingStep']` (`language→currency→lock→done`).
- Behaviour: Language step preselects `resolveLanguage(getLocales())` and switches UI live; Currency step preselects `resolveHomeCurrency`, searchable list (code + localized name via `Intl.DisplayNames`); also sets `taxYearStartMonth` default silently; Lock step offers enable (disabled with reason text if `canEnableLock` not ok) or Skip. Each step persists `onboardingStep` on advance so a kill/relaunch resumes the same step. Settings home-currency change in M1 just saves the pref (re-conversion arrives with FX in M2).

- [ ] **Step 1: Write failing tests:** `nextStep('language')==='currency'`, `('lock')==='done'`, `('done')==='done'`. Component test: rendering onboarding with prefs `onboardingStep:'currency'` shows the currency step first.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Device check:** fresh install → onboarding in device language; kill app on currency step → relaunch resumes there; rotate/unfold mid-step → selection kept; finish → tabs; Settings changes language live.
- [ ] **Step 6: Commit** — `git commit -am "feat: onboarding flow and settings basics"`

### Task 14: M1 acceptance pass

- [ ] **Step 1:** `npm test` all PASS; `npm run typecheck` clean.
- [ ] **Step 2:** Fresh install on iOS simulator, Android emulator, Pixel Fold emulator (folded + unfolded), iPad simulator: onboarding → tabs/rail → lock works → (dev) create receipt, search finds it.
- [ ] **Step 3:** Pull `meb.db` from simulator; `sqlite3 meb.db .tables` fails (encrypted). Check MMKV file not plaintext-readable (`strings` shows no `homeCurrency` value).
- [ ] **Step 4:** Confirm no network requests during the session (Proxyman/Charles) — M1 has zero allowed hosts.
- [ ] **Step 5:** Remove or `__DEV__`-guard `src/app/(dev)/*`. **Commit** — `git commit -am "chore: M1 acceptance"`; tag `m1`.
