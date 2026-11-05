# M2 — Capture & Parse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user can scan a paper receipt or import a screenshot, have it OCR'd and parsed on-device into a draft expense (total, date, currency, merchant, tax, category, reference no.), see duplicate / multi-receipt warnings, fix fields on a review screen, and save it — with page images encrypted at rest and foreign amounts converted at the purchase-date rate.

**Architecture:** Two local Expo modules do native work: new `modules/receipt-ocr` (Apple Vision / ML Kit text recognition + image hash) and existing `modules/receipt-ai` (on-device LLM, behind a flag). Everything else is TypeScript in `src/`: `images/` (downscale + AES-GCM file store), `parsing/` (heuristic parser — the product on most devices, incl. the owner's Redmi 14C), `fx/` (jsDelivr rate tables), `capture/` (pipeline + duplicate check, pure functions with injected deps), and two modal routes (capture, review). Drafts are DB rows (`status = 'draft'`), so review state survives fold/unfold and app kills.

**Tech Stack:** Expo SDK 58, RN 0.88, TypeScript strict, Expo Router, expo-sqlite (SQLCipher) + Drizzle, react-native-quick-crypto, react-native-mmkv, i18next. New: `react-native-document-scanner-plugin`, `expo-image-picker`, `expo-image-manipulator`, `expo-file-system`, `expo-screen-capture`, `zod`; Android `com.google.mlkit:text-recognition` (bundled Latin model).

**Spec:** `docs/superpowers/specs/2026-11-04-my-expenses-book-design.md`. Inputs: `docs/spikes/2026-11-ocr-bakeoff.md`, `docs/spikes/2026-11-receipt-ai.md`, `docs/m1-followups.md`.

## Global Constraints

- Scope ruling: "Share to app" (iOS share extension / Android share intent) is deferred to M5 — Import from Photos covers screenshots in M2. Cost if wrong: one extra tap for screenshot users until M5.

- App code lives in `apps/mobile/`; all paths below are relative to it unless they start with `docs/`.
- Install Expo packages with `npx expo install <pkg>` (SDK-58-matched versions). No other new deps beyond the Tech Stack list without a ledger ruling.
- TypeScript strict; `npx tsc --noEmit` and `npx jest` green at every commit.
- Tests never live under `src/app/` (Expo Router bundles them as routes → crash). Route logic that needs tests lives in `src/` and is imported by the route.
- Money is integer minor units (`toMinor`/`fromMinor`/`currencyExponent` from `src/money`); never floats for stored amounts.
- IDs via `newId()` (UUIDv7), timestamps via `now()` from `src/db/ids.ts`.
- Never edit an existing migration. New schema = new drizzle migration. Any migration that rebuilds `receipts` must recreate the FTS triggers (see warning in `src/db/schema.ts`); prefer `ALTER TABLE … ADD COLUMN`.
- Only allowed outbound network host in app code: `cdn.jsdelivr.net` (FX). No analytics, crash SDKs, or other hosts.
- Every user-facing string goes through i18next with keys in all 4 locales (`en`, `id`, `es`, `pt-BR`); `locales.test.ts` key-parity must stay green.
- Owner receipt photos (`spikes/receipts/`) and OCR dumps (`spikes/ocr-dumps/`) contain real PII: never commit, copy, or quote them. Committed fixtures must be synthetic.
- Dev-only screens live in `src/app/(dev)/` with the existing `__DEV__` guard.
- Min OS: iOS 16.4 deployment target, Android minSdk 26.
- On-device LLM parsing ships **disabled** (`AI_PARSING_ENABLED = false`) until verified on a physical supported device (owner's Redmi 14C has no Gemini Nano).
- Git identity is repo-local `Gia <terhubungapp@gmail.com>`; EAS account `gia-terhubung`. Never a work account.

## Review Focus

1. **Photo with no receipt / no readable total or date** (blank wall, handwritten nota): a draft is still created with the image, empty fields at confidence 0, and the review screen opens for manual entry — no crash, no fake numbers. → Task 7 test `returns nulls for non-receipt text`, Task 10 test `creates manual draft when parse finds nothing`.
2. **OCR native module throws or is missing** (web, Android ML Kit model init failure): pipeline falls back to a manual draft that keeps the image. → Task 10 test `falls back to manual draft when OCR throws`.
3. **FX unavailable** (offline, currency absent from table, first launch): receipt saves with `amountHomeMinor = null`, `fxRate = null`; same-currency receipts get rate `"1"` without network. → Task 8 tests `same currency needs no table`, `missing currency returns null conversion`.
4. **Ambiguous numeric dates** (`04/11/26`): IDR/EUR/etc. read day-first (4 Nov 2026), USD reads month-first; a parsed date more than 1 day in the future gets confidence ≤ 0.3. → Task 6 tests `day-first for IDR`, `month-first for USD`, `future date low confidence`.
5. **Plaintext leaks:** decrypted page images left in cache after viewing/backgrounding, and orphaned encrypted files after discard or app kill. → Task 3 tests `purgeDecryptedCache removes all view files`, `cleanupOrphanPages deletes files with no page row`.

---

### Task 1: M1 carry-overs — lock above modals, snapshot protection, secure-random check placement

**Files:**
- Create: `src/app/lock.tsx`, `src/lock/snapshotProtection.ts`, `src/lock/snapshotProtection.test.ts`
- Modify: `src/lock/LockGate.tsx`, `src/lock/LockGate.test.tsx`, `src/app/_layout.tsx`, `app.config.ts` (plugin only if `expo-screen-capture` needs one)

**Interfaces:**
- Consumes: `useLockGate()` (`src/lock/useLockGate.ts`), `LockScreen` (`src/lock/LockScreen.tsx`), `usePref("lockEnabled")`, `assertSecureRandom()`.
- Produces: route `/lock` (native `fullScreenModal`, `gestureEnabled: false`); `applySnapshotProtection(enabled: boolean, sc?: ScreenCaptureApi): Promise<void>`.

- [ ] **Step 1: Failing tests.** In `LockGate.test.tsx`: `pushes /lock above an open modal when locked` (mock router; with a modal route active, locking calls `router.push("/lock")` exactly once; unlocking calls `router.dismiss` on `/lock` only). In `snapshotProtection.test.ts`: `enables app-switcher protection and screen-capture block when lock enabled` (calls `enableAppSwitcherProtectionAsync` and `preventScreenCaptureAsync`), `disables both when lock disabled` (`disableAppSwitcherProtectionAsync`, `allowScreenCaptureAsync`).
- [ ] **Step 2:** Run `npx jest src/lock` → FAIL.
- [ ] **Step 3: Implement.** `npx expo install expo-screen-capture`. Lock renders as route `src/app/lock.tsx` registered in the root Stack with `presentation: "fullScreenModal", gestureEnabled: false`, so it stacks above any modal (native modals cover the root view, which is why the M1 overlay sat below them). The privacy cover stays as is. `applySnapshotProtection` runs from `LockGate` whenever `lockEnabled` changes. Move `assertSecureRandom()` from module scope into `RootLayout` render so a failure reaches the exported `ErrorBoundary`.
- [ ] **Step 4:** `npx jest && npx tsc --noEmit` → PASS. On the iOS simulator: open a settings sheet, background the app past the timeout, foreground → lock screen covers the sheet; app-switcher shows the blurred cover.
- [ ] **Step 5: Commit** `fix(lock): lock above modals, snapshot protection, secure-random in render`.

### Task 2: Migration 0002 — Transfer category, `ref_no`, `dhash`, page + duplicate queries

**Files:**
- Modify: `src/db/schema.ts`, `src/db/repositories/receipts.ts`, `src/db/migrations.test.ts`, `src/i18n/locales/{en,id,es,pt-BR}.json`
- Create: `src/db/migrations/0002_*.sql` (drizzle-kit generated) + custom seed SQL appended, `src/db/repositories/pages.ts`, `src/db/repositories/pages.test.ts`
- Test: `src/db/repositories/receipts.test.ts`

**Interfaces:**
- Consumes: `AppDb`, `newId`, `now`, test DB helper in `src/db/testing/`.
- Produces:
  - `receipts.refNo: string | null` (column `ref_no`, index `receipts_ref_no_idx`); `receiptPages.dhash: string | null` (column `dhash`, index `receipt_pages_dhash_idx`).
  - `createPage(db, input: { receiptId: string; pageIndex: number; imagePath: string; thumbPath: string | null; width: number; height: number; dhash: string | null }): ReceiptPage`
  - `listPages(db, receiptId: string): ReceiptPage[]` (ordered by pageIndex, excludes soft-deleted)
  - `listAllPagePaths(db): string[]` (image + thumb paths of all non-deleted pages)
  - `findReceiptsByRefNo(db, refNo: string, excludeId?: string): Receipt[]`
  - `listPageHashes(db): { receiptId: string; dhash: string }[]` (all non-deleted pages with a dhash; Hamming filtering happens in JS)
  - `findReceiptsByAmount(db, q: { currency: string; totalMinor: number; fromUtc: number; toUtc: number; excludeId?: string }): Receipt[]`
  - Type `ReceiptPage` exported from `src/db/types.ts`.
  - Category id `default:transfer`, `name_key 'transfer'`, `sort_order 95`, icon `arrow.left.arrow.right`, `is_default 1`.

- [ ] **Step 1: Failing tests.** `migrations.test.ts`: `0002 adds ref_no and dhash columns and keeps FTS triggers` (pragma table_info has both; the three `receipts_fts_*` triggers still exist), `seeds transfer category between office and other` (`listCategories` order …office(80), transfer(95), other(100)). `pages.test.ts`: create/list order, soft-deleted excluded, `listAllPagePaths` includes thumbs. `receipts.test.ts`: `findReceiptsByRefNo` excludes self and soft-deleted; `findReceiptsByAmount` matches currency+total within window only.
- [ ] **Step 2:** `npx jest src/db` → FAIL.
- [ ] **Step 3: Implement.** Add columns to `schema.ts`, run `npx drizzle-kit generate` (must produce `ALTER TABLE … ADD COLUMN`, not a table rebuild — if it rebuilds, stop and hand-write the ALTER migration), append the seed `INSERT` to the generated SQL, regenerate `migrations.js`. Add `"transfer"` under `categories` in all 4 locales (en "Transfer", id "Transfer", es "Transferencia", pt-BR "Transferência").
- [ ] **Step 4:** `npx jest && npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(db): migration 0002 — transfer category, ref_no, dhash, page queries`.

### Task 3: Encrypted image store

**Files:**
- Create: `src/images/crypto.ts`, `src/images/crypto.test.ts`, `src/images/store.ts`, `src/images/store.test.ts`, `src/images/ImageStoreProvider.tsx`
- Modify: `src/db/client.ts` (`resetLocalData` also deletes the pages dir), `src/app/_layout.tsx` (mount provider inside `DatabaseProvider`)

**Interfaces:**
- Consumes: `deriveKey(master, "images")`, `getOrCreateMasterKey(expoSecretStore)`, `listAllPagePaths` (Task 2).
- Produces:
  - `encryptBytes(key: Uint8Array, plain: Uint8Array): Uint8Array` / `decryptBytes(key: Uint8Array, blob: Uint8Array): Uint8Array` — format `"MEB1"` (4 ASCII bytes) ‖ 12-byte random IV ‖ ciphertext ‖ 16-byte GCM tag; throws `ImageDecryptError` on bad magic/tag.
  - `interface ImageStore { savePage(srcUri: string): Promise<{ imagePath: string; thumbPath: string; width: number; height: number; normalizedUri: string }>; openForView(path: string): Promise<string /* file:// in cache */>; deleteFiles(paths: string[]): Promise<void>; purgeDecryptedCache(): Promise<void>; cleanupOrphanPages(knownPaths: string[]): Promise<number> }`
  - `createImageStore(deps: { key: Uint8Array; fs: FileOps; manipulate: Manipulate }): ImageStore` — `FileOps`/`Manipulate` are thin interfaces over `expo-file-system` / `expo-image-manipulator` so tests use in-memory fakes.
  - `useImageStore(): ImageStore`.
  - Values: page JPEG long edge 1600 px, quality 0.8; thumb long edge 320 px; encrypted files under `Paths.document/pages/<uuid>.enc`; view files under `Paths.cache/view/`. `normalizedUri` = the downscaled plaintext JPEG in cache, handed to OCR then deleted by the caller.

- [ ] **Step 1: Failing tests.** `crypto.test.ts`: round-trip; two encryptions of same input differ (IV); tampered byte → `ImageDecryptError`; wrong key → `ImageDecryptError`; starts with `MEB1`. `store.test.ts`: `savePage writes two encrypted files and no plaintext under pages/`, `openForView returns cache file with original bytes`, `purgeDecryptedCache removes all view files`, `cleanupOrphanPages deletes files with no page row` (returns count, keeps known), `deleteFiles ignores missing files`.
- [ ] **Step 2:** `npx jest src/images` → FAIL.
- [ ] **Step 3: Implement.** `npx expo install expo-file-system expo-image-manipulator`. AES-256-GCM via `react-native-quick-crypto` `createCipheriv('aes-256-gcm', …)` (Node `crypto` in Jest via existing mapper). Provider derives the key once, runs `cleanupOrphanPages(listAllPagePaths(db))` after DB open, and calls `purgeDecryptedCache()` on mount and whenever `AppState` leaves `active`.
- [ ] **Step 4:** `npx jest && npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(images): AES-GCM encrypted page store with cache purge and orphan cleanup`.

### Task 4: `modules/receipt-ocr` — Vision / ML Kit OCR + image hash

**Files:**
- Create: `modules/receipt-ocr/` (via `npx create-expo-module@latest receipt-ocr --local --barrel --name ReceiptOcr --package expo.modules.receiptocr -p apple android --features AsyncFunction`), `src/ocr/readingOrder.ts`, `src/ocr/readingOrder.test.ts`, `src/ocr/dhash.ts`, `src/ocr/dhash.test.ts`, `src/app/(dev)/ocr-check.tsx`, `eas.json`
- Modify: `src/app/(tabs)/settings.tsx` (dev link to ocr-check, inside existing `__DEV__` block)

**Interfaces:**
- Produces (JS, from `modules/receipt-ocr`):
  - `type OcrBox = { x: number; y: number; w: number; h: number }` — normalized 0..1, **top-left origin, in upright orientation**.
  - `type OcrObservation = { text: string; box: OcrBox; confidence: number }`
  - `type OcrResult = { observations: OcrObservation[]; width: number; height: number; rotation: 0 | 90 | 180 | 270; ms: number }`
  - `recognizeText(uri: string, languages: string[]): Promise<OcrResult>` — rejects with code `ERR_OCR`.
  - `imageHash(uri: string): Promise<string>` — 64-bit dHash as 16 lowercase hex chars (9×8 grayscale, compare adjacent pixels per row).
- Produces (JS, `src/ocr/`): `toLines(obs: OcrObservation[]): string[]` (rows top→bottom, items in a row left→right joined by two spaces; same row when vertical centers differ by < 0.5 × box height); `hamming(a: string, b: string): number`; `OCR_LANGUAGES(uiLanguage: Language): string[]` → `["id-ID","en-US"]` plus the UI language's Vision code if different (`es-ES`, `pt-BR`).
- Native rules (from the bake-off): always set recognition languages (iOS `automaticallyDetectsLanguage = false`; filter to `supportedRecognitionLanguages()`, fall back to `["en-US"]`); `.accurate` level with language correction. **Rotation:** if > 60% of observations have `h > w` in pixel terms, re-run at 90° and 270° (`CGImagePropertyOrientation .left / .right`; Android `InputImage` rotation 90/270) and return the pass with the higher mean confidence, with boxes in that pass's upright frame. Android: `com.google.mlkit:text-recognition` (bundled Latin, check latest on Google Maven), boxes from `Text.TextBlock.lines` normalized by image size.

- [ ] **Step 1: Failing tests.** `readingOrder.test.ts`: `merges same-row boxes left to right` (`[{"Total",x .1,y .5},{"Rp41.000",x .7,y .505}]` → `["Total  Rp41.000"]`), `orders rows top to bottom`. `dhash.test.ts`: `hamming("ffffffffffffffff","0000000000000000") === 64`, identical → 0, throws on length mismatch.
- [ ] **Step 2:** `npx jest src/ocr` → FAIL.
- [ ] **Step 3: Implement** module (Swift + Kotlin), JS helpers, and the dev screen: pick N images from Photos (`expo-image-picker`, `npx expo install expo-image-picker`), run `recognizeText` + `imageHash` on each, show lines + ms + rotation, and a "Copy report" button (text only, stays on device). Add `eas.json` with a `development` profile (`developmentClient: true`, `distribution: internal`, Android `buildType: apk`).
- [ ] **Step 4: Verify.** `npx jest && npx tsc --noEmit` → PASS. iOS: `npx expo run:ios`; `xcrun simctl addmedia booted <owner photo>` for 3 local photos (screenshot #01, rotated label #21, Indomaret #18 — do not copy them anywhere else); ocr-check shows clean text and `rotation: 90` or `270` for #21. Android compile: `npx eas-cli build -p android --profile development --non-interactive` on account `gia-terhubung` must finish green (counts toward the free monthly quota — run once, here). Record build URL in the task report.
- [ ] **Step 5: Commit** `feat(ocr): receipt-ocr module (Vision / ML Kit), rotation retry, dHash`.

### Task 5: Parser fixtures (50, synthetic) + PII guard

**Files:**
- Create: `src/parsing/__fixtures__/NN-<slug>.txt` (50 files), `src/parsing/__fixtures__/expected.json`, `scripts/check-fixture-pii.mjs`
- Modify: `package.json` (script `"check:pii": "node scripts/check-fixture-pii.mjs"`)

**Interfaces:**
- Produces: `expected.json` = `{ [file: string]: { total: string | null; currency: string; date: string | null /* YYYY-MM-DD */; time?: string /* HH:mm */; merchant?: string; tax?: string; refNo?: string; category?: string; split?: number /* receipts in text, default 1 */ } }` — amounts as decimal strings in major units (`"96000"`, `"12.34"`).

- [ ] **Step 1: Write fixtures.** 24 modelled on the owner OCR dumps in `spikes/ocr-dumps/vision-id/` (same layout, line breaks, and OCR noise — e.g. `RP  1, 000, 000. 00`, `27 SEP. 20`, two-label photo with repeated `J&T EXPRESS` header and `split: 2`, EDC+POS photo with equal totals and `split: 1`, handwritten notes whose expected values are the true ones even though the text is garbled) but with **every** name, account number, phone, address, reference/waybill/transaction ID, and NPWP replaced by invented values of the same shape. 26 new foreign/travel fixtures: at least USD (US, MM/DD), EUR (FR `TOTAL À PAYER`, ES `TOTAL A PAGAR`/IVA, DE `SUMME`/MwSt, comma decimals), GBP (VAT), JPY (`合計`, 0 decimals), SGD, MYR (`RM`), THB, BRL (`TOTAL A PAGAR`, `R$ 1.234,56`), AUD, VND (dot thousands, 0 decimals), plus one non-receipt text (`total: null, date: null`).
- [ ] **Step 2: Implement `check-fixture-pii.mjs`:** if `spikes/ocr-dumps/` exists, collect every digit run ≥ 6 and every ALL-CAPS word sequence that follows the labels `Penerima|Pengirim|From|Name|Nama|Beneficiary Name|Rekening Sumber|Rekening Tujuan|Ditransfer ke`; exit 1 listing any that appear in `src/parsing/__fixtures__/`. If dumps are absent, print `skip: no dumps` and exit 0.
- [ ] **Step 3:** `npm run check:pii` → exit 0. `git status` shows nothing under `spikes/`.
- [ ] **Step 4: Commit** `test(parsing): 50 synthetic receipt fixtures + PII guard`.

### Task 6: Parser primitives — amounts, dates, currency

**Files:**
- Create: `src/parsing/heuristics/amount.ts`, `amount.test.ts`, `date.ts`, `date.test.ts`, `currency.ts`, `currency.test.ts`

**Interfaces:**
- Produces:
  - `findAmounts(line: string): { value: string /* major-unit decimal */; raw: string; negative: boolean; start: number }[]`
  - `detectCurrency(text: string, fallback: string): { code: string; confidence: number }`
  - `findDates(line: string, opts: { order: "DMY" | "MDY" | "YMD"; today: Date }): { date: string /* YYYY-MM-DD */; time: string | null; confidence: number; start: number }[]`
  - `dateOrderFor(currency: string): "DMY" | "MDY" | "YMD"` — `USD → MDY`; `JPY, CNY, KRW, TWD → YMD`; everything else `DMY`.

- [ ] **Step 1: Failing tests** (table-driven):
  - amounts: `Rp96.000→96000`, `Rp 750.000→750000`, `IDR 100,000.00→100000`, `IDR 1,900,000→1900000`, `RP  1, 000, 000. 00→1000000`, `(8,000)→8000 negative`, `-Rp461.000→461000 negative`, `€12,50→12.50`, `1.234,56 €→1234.56`, `$1,234.56→1234.56`, `R$ 1.234,56→1234.56`, `¥1,280→1280`, `24.000→24000` (3 digits after single dot = thousands), `12.5→12.5`.
  - currency: `Rp`/`IDR`→IDR, `US$`/`$` (no other hint)→USD, `S$`→SGD, `A$`→AUD, `R$`→BRL, `RM`→MYR, `€`→EUR, `£`→GBP, `¥`/`円`→JPY, `฿`/`THB`→THB, `₫`/`VND`→VND; none → fallback with confidence 0.
  - dates: `16 Okt 2026→2026-10-16`, `01 Nov 2026 • 14:09:33 WIB→2026-11-01 14:09`, `29.09.26-20:26→2026-09-29 20:26`, `05-11-2026→2026-11-05`, `1 Oktober 2026, 13:29 WIB`, `27 Sep 2026, 13.41→13:41`, `Oct 16, 2026`, `2026-10-16`, `2026/10/16`, `16/10/2026`; `day-first for IDR` (`04/11/26`, DMY → `2026-11-04`), `month-first for USD` (MDY → `2026-04-11`); `future date low confidence` (today 2026-11-05, `20/12/2026` → confidence ≤ 0.3); `27 SEP. 20` → `2020-09-27` with confidence ≤ 0.5 (year far from today).
- [ ] **Step 2:** `npx jest src/parsing/heuristics` → FAIL.
- [ ] **Step 3: Implement.** Month names: ID (`Jan Feb Mar Apr Mei Jun Jul Agu/Agt Sep Okt Nov Des` + full), EN, ES, PT, FR, DE. Thousands vs decimal: rightmost separator followed by exactly 3 digits and no other separator kind → thousands; otherwise decimal; strip spaces inside a number token first.
- [ ] **Step 4:** `npx jest && npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(parsing): amount, date, currency primitives`.

### Task 7: Heuristic parser — assembly, split detection, accuracy gate

**Files:**
- Create: `src/parsing/types.ts`, `src/parsing/heuristics/index.ts`, `src/parsing/heuristics/keywords.ts`, `src/parsing/heuristics/split.ts`, `src/parsing/heuristics/parse.test.ts`, `src/parsing/heuristics/split.test.ts`, `src/parsing/accuracy.test.ts`

**Interfaces:**
- Consumes: Task 6 primitives; `toMinor`; fixtures from Task 5.
- Produces:
  - `type FieldConfidence = { merchant: number; date: number; total: number; tax: number; currency: number; category: number }`
  - `type ParsedReceipt = { merchant: string | null; purchasedDate: string | null /* YYYY-MM-DD */; purchasedTime: string | null; currency: string; totalMinor: number | null; taxMinor: number | null; categoryId: string | null; refNo: string | null; confidence: FieldConfidence; source: ParseSource }`
  - `parseHeuristic(lines: string[], hints: { homeCurrency: string; today: Date }): ParsedReceipt`
  - `splitReceipts(lines: string[]): { segments: string[][]; reason: "single" | "repeated-header" }`
- Rules: total = amount on the line (or next line) matching a total keyword, highest-priority keyword wins (`GRAND TOTAL`, `TOTAL BAYAR/PEMBAYARAN/PAYMENT/TRANSAKSI/PESANAN/BELANJA/BIAYA/NOMINAL`, `TOTAL`, `JUMLAH`, `TAGIHAN`, `AMOUNT`, `TOTAL A PAGAR`, `TOTAL À PAYER`, `SUMME`, `合計`), skipping lines with `SUBTOTAL`, `DISKON/DISCOUNT`, `KEMBALI/CHANGE`, `HEMAT`, `DPP`, `PPN/TAX/VAT/IVA/TVA/MwSt` (those feed tax), `ADMIN/FEE/BIAYA ADMIN`; fallback = largest amount at confidence 0.3. Ref no from labels `Reference No.`, `No. Referensi`, `ID transaksi`, `Receipt Number`, `TRXID`, `Nomor Seri`, `ID #`, or a waybill-like token `^[A-Z]{2}\d{10,}$`. Category ids: transfer keywords (`Transfer`, `BI Fast`, `Virtual Account`, `Top ?up`, `Tarik Tunai`, `Cash Withdrawal`, `Ditransfer`) → `default:transfer`; `Indomaret|Alfamart|supermarket` → `default:groceries`; `Token Listrik|PLN` → `default:utilities`; `Grab|Gojek ride|taxi|Uber` → `default:transport`; restaurant/café words → `default:food_drink`; else null. Merchant = first line with ≥ 3 letters that is not a status-bar/time line, bank boilerplate (`Transaksi Berhasil`, `Transfer Successful`…), or a label. Split: a header line (one of the first 3 non-noise lines) that recurs later starts a new segment **only if** segments have different totals; equal totals → `single`.

- [ ] **Step 1: Failing tests.** `parse.test.ts`: `prefers Total Transaksi over Nominal and Biaya Admin` (752500), `skips subtotal and discount` (Indomaret-style → 24000, tax 3320), `returns nulls for non-receipt text` (all null, confidences 0), `extracts waybill ref`, `classifies BI Fast as transfer`. `split.test.ts`: `splits two labels with repeated header and different totals` (2 segments), `does not split EDC slip over its POS receipt` (equal totals → single). `accuracy.test.ts`: runs every fixture through `splitReceipts` + `parseHeuristic`, prints a table, and asserts **total AND date correct on ≥ 85% of the 50** (a split fixture counts correct only if segment count matches `split` and each segment is correct).
- [ ] **Step 2:** `npx jest src/parsing` → FAIL.
- [ ] **Step 3: Implement** to the rules above; extend keyword tables, never fixture-specific hacks (no file names or literal fixture values in code).
- [ ] **Step 4:** `npx jest && npx tsc --noEmit` → PASS; paste the accuracy table into the task report.
- [ ] **Step 5: Commit** `feat(parsing): heuristic parser with split detection (accuracy N/50)`.

### Task 8: FX — rate tables, frozen conversion, home-currency re-convert

**Files:**
- Create: `src/fx/rates.ts`, `src/fx/rates.test.ts`, `src/fx/convert.ts`, `src/fx/convert.test.ts`, `src/fx/reconvert.ts`, `src/fx/reconvert.test.ts`
- Modify: `src/prefs/prefs.ts` (+ `fxTables` pref), `src/prefs/prefs.test.ts`

**Interfaces:**
- Produces:
  - Pref `fxTables: FxCache` where `FxCache = { base: string; latestDate: string | null; fetchedAt: number | null; byDate: Record<string /* YYYY-MM-DD */, Record<string /* lowercase code */, string /* rate, units per 1 base */>> }`; default `{ base: "", latestDate: null, fetchedAt: null, byDate: {} }`. Keep at most 120 dates (drop oldest).
  - `rateUrl(base: string, date: string | "latest"): string` → `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${base.toLowerCase()}.json`
  - `fetchRates(base, date, fetchFn = fetch): Promise<{ date: string; rates: Record<string, string> }>` (rates as strings via `String(n)`)
  - `ensureRates(cache: FxCache, base: string, date: string, now: number, fetchFn?): Promise<FxCache>` — refresh `latest` if `fetchedAt` older than 7 days; fetch `date` if absent and online; on network error return cache unchanged.
  - `convertToHome(totalMinor: number, currency: string, home: string, purchaseDate: string, cache: FxCache): { amountHomeMinor: number; fxRate: string; fxRateDate: string; approximate: boolean } | null` — exact date if cached, else nearest earlier date (`approximate: true`), else null. Same currency → rate `"1"`, no cache needed. Table rates are *receipt-currency units per 1 home unit* (API shape, base = home); the stored `fxRate` is the human-readable inverse — *home units per 1 receipt-currency unit* — as a decimal string. Decimal math via BigInt (scale 10^12), round half away from zero, respecting both currencies' exponents.
  - `reconvertAll(db: AppDb, home: string, cache: FxCache): number` — updates `fxRate`, `fxRateDate`, `amountHomeMinor`, `fxApproximate`, `homeCurrencyAtSave` on all non-deleted receipts; returns count.
- [ ] **Step 1: Failing tests.** `rateUrl` exact string; `fetchRates` parses a fixture JSON `{ date, idr: { usd: 0.0000613 } }`; `ensureRates` skips fetch when fresh, refreshes when 8 days old, returns unchanged on throw; `same currency needs no table`; `missing currency returns null conversion`; `uses nearest earlier date and flags approximate`; `converts USD 12.34 to IDR` (cache base `idr`, `usd: "0.00005"` → `fxRate "20000"`, `amountHomeMinor 24680000` because IDR exponent is 2); JPY→IDR (0-decimal source); `reconvertAll` updates two receipts and skips soft-deleted.
- [ ] **Step 2:** `npx jest src/fx src/prefs` → FAIL.
- [ ] **Step 3: Implement.** Hook in `src/fx/useFx.ts`: on `homeCurrency` pref change, `ensureRates` for latest then `reconvertAll` (run in an effect mounted in `_layout.tsx` under `PrefsProvider`).
- [ ] **Step 4:** `npx jest && npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(fx): jsDelivr rate cache, frozen purchase-date conversion, re-convert on home change`.

### Task 9: On-device LLM path — validate, merge, flag off

**Files:**
- Create: `src/parsing/llm.ts`, `src/parsing/llm.test.ts`, `src/parsing/index.ts`, `src/parsing/index.test.ts`, `src/parsing/flags.ts`
- Modify: `modules/receipt-ai/android/src/main/java/expo/modules/receiptai/ReceiptAIModule.kt`

**Interfaces:**
- Consumes: `ReceiptAI.getAvailability()`, `ReceiptAI.parseReceipt(ocrText, { locale, homeCurrency })` (JSON string `{merchant,purchasedAt,total,tax,currency}`, all strings); `parseHeuristic`, `ParsedReceipt`.
- Produces:
  - `export const AI_PARSING_ENABLED = false` (`flags.ts`).
  - `parseLlmOutput(raw: string, homeCurrency: string): Partial<ParsedReceipt> | null` — strips ``` fences, extracts first `{…}`, validates with zod; invalid → null.
  - `mergeParsed(heur: ParsedReceipt, llm: Partial<ParsedReceipt> | null): ParsedReceipt` — LLM wins merchant/category when heuristic confidence < 0.6; for total/date: agree → confidence 0.95; disagree → keep heuristic if its confidence ≥ 0.8 else LLM at confidence 0.5; `source` = engine when any LLM field used.
  - `parseReceipt(lines: string[], hints: { homeCurrency: string; locale: string; today: Date }, ai = ReceiptAI): Promise<ParsedReceipt>` — heuristic always; LLM only if `AI_PARSING_ENABLED` and available, 15 s timeout, any error → heuristic result.
- [ ] **Step 1: Failing tests.** `parseLlmOutput` accepts fenced JSON, rejects non-JSON and negative totals; `mergeParsed` four agreement cases; `parseReceipt` never calls `ai.parseReceipt` while flag is false; with flag forced true (inject) falls back to heuristic on timeout/reject.
- [ ] **Step 2:** `npx jest src/parsing` → FAIL.
- [ ] **Step 3: Implement.** `npx expo install zod`. Kotlin: hold one `GenerativeModel` client (lazy, closed in `OnDestroy`), map `checkStatus()` throws to `ERR_UNAVAILABLE`; no model download (DOWNLOADABLE reports unavailable).
- [ ] **Step 4:** `npx jest && npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** `feat(parsing): LLM output validation and merge behind disabled flag`.

### Task 10: Capture pipeline, duplicate check, entry points

**Files:**
- Create: `src/capture/pipeline.ts`, `src/capture/pipeline.test.ts`, `src/capture/duplicates.ts`, `src/capture/duplicates.test.ts`, `src/capture/CaptureSheet.tsx`, `src/app/(modals)/_layout.tsx`, `src/app/(modals)/capture.tsx`
- Modify: `src/app/(tabs)/index.tsx` (FAB → capture), `src/app/_layout.tsx` (register `(modals)` group with `presentation: "modal"`), locales

**Interfaces:**
- Consumes: `ImageStore` (T3), `recognizeText`/`imageHash`/`toLines`/`hamming`/`OCR_LANGUAGES` (T4), `splitReceipts`/`parseReceipt` (T7/T9), `convertToHome`/`ensureRates` (T8), repos (T2), `createReceipt`, prefs.
- Produces:
  - `type Analysis = { normalizedUris: string[]; dhash: string | null; lines: string[]; segments: string[][]; splitReason: "single" | "repeated-header"; ocrFailed: boolean }`
  - `analyzeCapture(uris: string[], deps: CaptureDeps): Promise<Analysis>` — `uris` = pages of ONE receipt (scanner) or ONE imported photo; dHash of first page.
  - `createDrafts(analysis: Analysis, choice: "split" | "single", deps: CaptureDeps): Promise<string[] /* receipt ids */>` — encrypts pages via `savePage`, deletes `normalizedUris`, creates `status: 'draft'` receipts (`parseSource` from parse; `manual` when `ocrFailed` or nothing parsed; `rawOcrText` = segment text; `refNo`; FX fields via `convertToHome`; `purchasedAtLocal` = parsed date+time or scan time; `scannedAtUtc`/`scannedTz` from deps clock + `Intl` zone). With `split`, every segment's receipt gets its own page rows pointing at the same encrypted files.
  - `findDuplicates(db, r: Receipt, pageHashes: string[]): DuplicateMatch[]` with `DuplicateMatch = { receiptId: string; strength: "exact-ref" | "same-image" | "similar" }`, ordered strongest first: same `refNo`; any page dHash within Hamming ≤ 6; same currency + `totalMinor` + purchase date ±1 day + merchant similarity (normalized token Jaccard ≥ 0.5, or skip merchant test when either is null). Excludes self, soft-deleted, and drafts.
  - `CaptureDeps` = `{ db; images: ImageStore; ocr: { recognizeText; imageHash }; parse: typeof parseReceipt; fx: FxCache; home: string; uiLanguage: Language; clock: () => Date }`.
- UI: FAB opens `CaptureSheet` with **Scan receipt** (`react-native-document-scanner-plugin`, multi-page → one receipt) and **Import from Photos** (`expo-image-picker`, multi-select → one receipt per photo). `capture.tsx` shows progress, then — if `segments.length > 1` — asks "This photo has N receipts" with **Split into N** (default) / **Keep as one** (sum). Then routes to `/(modals)/review/<firstId>`, with remaining ids queued as params.
- [ ] **Step 1: Failing tests.** `pipeline.test.ts` (fakes for every dep): `creates one draft per segment when split`, `keep-as-one sums segment totals`, `creates manual draft when parse finds nothing`, `falls back to manual draft when OCR throws` (image still saved), `deletes normalized plaintext files`, `sets FX fields for foreign currency and null when unavailable`. `duplicates.test.ts`: exact-ref beats similar; dHash distance 6 matches, 7 doesn't; ±1 day window; drafts and soft-deleted ignored; null merchant still matches on amount+date.
- [ ] **Step 2:** `npx jest src/capture` → FAIL.
- [ ] **Step 3: Implement.** `npx expo install react-native-document-scanner-plugin` (+ its config plugin/camera permission strings in `app.config.ts`; iOS `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`). Strings in all 4 locales.
- [ ] **Step 4:** `npx jest && npx tsc --noEmit` → PASS. iOS sim: Import from Photos with an added photo → lands on review route with a draft id.
- [ ] **Step 5: Commit** `feat(capture): scan/import pipeline, multi-receipt split, duplicate check`.

### Task 11: Review screen

**Files:**
- Create: `src/app/(modals)/review/[id].tsx`, `src/review/useReviewForm.ts`, `src/review/useReviewForm.test.tsx`, `src/review/ReviewFields.tsx`, `src/review/PageViewer.tsx`, `src/review/DuplicateBanner.tsx`
- Modify: locales

**Interfaces:**
- Consumes: `getReceipt`, `updateReceipt`, `softDeleteReceipt`, `listPages`, `findDuplicates`, `ImageStore.openForView`/`deleteFiles`, `convertToHome`, `listCategories`, `TwoPane`/`useWindowClass`, `CurrencyPicker`.
- Produces: `useReviewForm(id: string): { values; setField(name, value); lowConfidence: Set<keyof FieldConfidence>; duplicates: DuplicateMatch[]; save(): Promise<void>; discard(): Promise<void> }` — every field edit writes through to the draft row (debounced 300 ms, so fold/unfold or process death loses nothing); `save()` validates (total required, currency known, date required), runs `ensureRates` for the purchase date (best effort, offline OK), recomputes FX, sets `status: 'confirmed'`, routes to the next queued id or closes; `discard()` soft-deletes the receipt and deletes its page files when no other receipt references them.
- Layout: compact = page image on top (tap → full screen), fields below; medium/expanded = image left / fields right via `TwoPane`. Fields: merchant, date, time, total, currency, tax, category (incl. Transfer), notes. Fields with confidence < 0.6 get a highlighted border + "Check this" hint. Foreign currency shows "≈ <home amount>" and "approximate rate" when flagged; a manual rate override field. `DuplicateBanner`: "Already saved" (exact-ref) / "Possible duplicate" with **View** and **Save anyway**. "Add manually" (no image) entry from `CaptureSheet` opens this screen on an empty `manual` draft.
- [ ] **Step 1: Failing tests** (`useReviewForm.test.tsx`, test DB + fake image store): `writes edits through to the draft`, `save rejects missing total`, `save confirms and recomputes FX`, `discard deletes files not shared with a split sibling`, `exposes low-confidence fields from parse_confidence`, `lists duplicates excluding self`.
- [ ] **Step 2:** `npx jest src/review` → FAIL.
- [ ] **Step 3: Implement** screen + components; decrypted view files come only from `openForView` and are purged by the provider (Task 3).
- [ ] **Step 4:** `npx jest && npx tsc --noEmit` → PASS. iOS sim (iPhone + iPad sizes if the iPad sim boots): import → review → edit total → background/foreground → value kept → save.
- [ ] **Step 5: Commit** `feat(review): draft review screen with confidence hints, duplicates, FX preview`.

### Task 12: M2 acceptance

**Files:**
- Create: `docs/m2-acceptance.md`, `docs/m2-evidence/*.png`
- Modify: `docs/m1-followups.md` (close items done in M2)

- [ ] **Step 1:** Full `npx jest`, `npx tsc --noEmit`, `npm run check:pii`, static network audit (`grep -rnE "fetch\(|XMLHttpRequest|WebSocket" src modules` → only `src/fx/rates.ts`). Record outputs.
- [ ] **Step 2:** iOS simulator end-to-end with screenshots: import screenshot → parsed review → save; rotated photo; two-label photo → split prompt → 2 drafts; re-import same photo → duplicate banner; foreign fixture typed in manually → FX line; lock over review modal.
- [ ] **Step 3:** Build one Android development APK (`npx eas-cli build -p android --profile development`) and write the owner checklist for the Redmi 14C into `docs/m2-acceptance.md`: install APK; ocr-check on the 24 WhatsApp photos (target total ≥ 23/24, date ≥ 21/24, copy report into the doc); scan a paper receipt (multi-page); import → review → save; lock + recents thumbnail hidden; fold/rotate n/a — rotate phone mid-review; note ms per photo (low-end device budget: ≤ 2 s OCR). Mark each row PASS / FAIL / OWNER-PENDING.
- [ ] **Step 4: Commit** `docs: M2 acceptance`.
