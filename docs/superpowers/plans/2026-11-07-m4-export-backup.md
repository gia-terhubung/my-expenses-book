# M4 Export & Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users get their receipts out of the app and back in. It has four parts:
- CSV export of a date range and/or folder
- a PDF report of the same selection, with totals and embedded thumbnails
- a `.meb` backup archive (passphrase on by default, skippable) and restore by replace or merge-by-UUID
- a gentle backup reminder after N new receipts

**Architecture:**
- **Selection:** export reuses M3's `ReceiptFilter` + `listReceipts`/`sumHome` (`src/db/repositories/receiptQueries.ts`), so export shows exactly what the feed/folder/tax-year views show.
- **Export files:** CSV/PDF/`.meb` are written to `cache/export/`, handed to the OS share sheet (`expo-sharing`), and purged on cold start and before the next export — never on `background`, because the share sheet and document picker background the app.
- **Archive:** a custom streaming container (`MEBA`), one record per item, each record AES-256-GCM encrypted with a key derived by scrypt from the passphrase. Rows travel as a validated JSON snapshot of every table (soft-deleted rows included, so tombstones survive); page images are decrypted with the device image key and re-encrypted with the archive key, one at a time, so memory stays at one page.
- **Restore:** page files are written first under fresh paths, then one DB transaction applies replace (wipe + insert) or merge (last-write-wins by `updated_at`), then an FTS rebuild, then orphan-page cleanup. Any failure before commit deletes the new files and leaves the old data untouched.

**Tech Stack:**
- Expo SDK 58, RN 0.88, TS strict, Expo Router (routes in `src/app`).
- expo-sqlite SQLCipher + Drizzle + FTS5; `react-native-quick-crypto` (AES-256-GCM via `src/images/crypto.ts`, `scrypt`); `expo-file-system` (`File`, `FileHandle`).
- **New deps (owner-approved in the spec's stack list):** `expo-print`, `expo-sharing`, `expo-document-picker`. Install with `npx expo install` so versions match SDK 58.
- Jest with jest-expo; `better-sqlite3` test DB (`src/db/testing/testDb.ts`).

**Spec:** `docs/superpowers/specs/2026-11-04-my-expenses-book-design.md` (M4 row, "Backup v1", "Duplicate warning" — merge import, "Export" in Technical architecture, "Verification" — backup round-trip, CSV output, privacy check). Carry-overs: `docs/m3-followups.md`.

**Calls made by the plan author (owner may override at review):**
- **C1 — Container instead of zip.** The spec names `react-native-zip-archive`. This plan uses a custom streaming container over `expo-file-system` `FileHandle` instead: no native zip dep, no zip-slip path handling on import, no plaintext staging directory, and the whole format is unit-testable in Jest. The `.meb` name, passphrase default, KDF → AES-256-GCM, share-sheet delivery and replace/merge restore are exactly as specced. Cost if wrong: an unpassphrased `.meb` cannot be opened with a desktop unzip tool.
- **C2 — Rows as JSON snapshot, not a DB file copy.** A SQLCipher file is tied to the device key and cannot be merged; a JSON row snapshot can be validated, merged by UUID and re-imported on a new device.
- **C3 — KDF:** scrypt, N=2^15, r=8, p=1, 32-byte key, 16-byte random salt, params stored in the archive header (32 MB RAM — safe on low-end Android). Passphrase NFC-normalized, minimum 8 characters.
- **C4 — Merge rule:** per row, by `id`: absent locally → insert; present → keep the row with larger `updated_at` (tie: larger `version`; still tied: keep local). Same rule later sync will use.
- **C5 — Replace restores prefs** `homeCurrency` and `taxYearStartMonth` from the archive; merge keeps local prefs. Lock settings and language are never restored.
- **C6 — Reminder:** after 20 receipts confirmed since the last backup; "Later" snoozes 7 days.
- **C7 — CSV:** UTF-8 with BOM, CRLF, RFC 4180 quoting, localized header row, ISO dates, `.` decimal separator, one row per receipt. No totals row (totals live in the PDF).
- **C8 — "Backup done"** (`lastBackupAt = now`, `receiptsSinceBackup = 0`) is recorded when the share sheet resolves without error; the app cannot know whether the user actually saved the file.

## Global Constraints

**Testing and tooling**
- Tests NEVER live under `src/app/`. Route files stay thin; logic and tests go in `src/<feature>/`.
- All commands run in `apps/mobile`. Gates at every commit: `npx jest`, `npx tsc --noEmit`, `npm run check:pii`.
- Git identity is the repo-local Gia <terhubungapp@gmail.com>; never the work identity. Never commit, read or quote `apps/mobile/spikes/receipts/` or `spikes/ocr-dumps/` (real PII). All test data is synthetic.
- Work on branch `feat/m4-export-backup` from `main` (dc32270).
- Only the three new deps above. No others.

**Money, dates, totals**
- Money is integer minor units. Decimal strings via `fromMinor(minor, code)`; display via `formatMoney(minor, code, locale)` (`src/money/money.ts`). Never floats.
- "Totals never mix currencies": home totals come only from `sumHome`/`monthTotals`; unconverted rows are counted and shown as "N not converted", never added.
- Exports include `status = 'confirmed' AND deleted_at IS NULL` only (the `ReceiptFilter` conditions). Order `purchased_at_local DESC, id DESC`. Dates shown are `purchased_at_local` (wall clock).

**Data safety**
- "Losing data on app update/migration" is an anti-goal: a restore that fails at any point leaves the existing DB rows and page files exactly as they were.
- FTS warning (`src/db/schema.ts`): every restore path ends with `INSERT INTO receipts_fts(receipts_fts) VALUES('rebuild')`.
- Soft delete only in normal writes. Restore replace is the one place rows are hard-deleted, inside its transaction.
- The backup passphrase is never persisted, logged, or put in a route param.
- Plaintext export files live only in `cache/export/` and the document picker's cache copy; both are purged on cold start. The background purge must not touch `cache/export/`.

**Network**
- No new network calls. PDF HTML must reference no remote resource (no `http`); images are inline `data:` URIs.

**UI rules**
- Every RN `Modal` is `AppModal` (`appModalGuard.test.ts`). Touch targets ≥48. Colors/spacing/type from `useTheme()`. Export and backup screens are centered `maxWidth: 560` on every window class.
- Every new string goes into all 4 locale files `src/i18n/locales/{en,id,es,pt-BR}.json` with identical key sets (`locales.test.ts`). New namespaces: `export`, `backup`. en is authored; id/es/pt-BR careful translations.
- Destructive confirmations (restore replace, skip passphrase) use `Alert` with a destructive-style button and full-sentence copy.

## Review Focus

1. **Share sheet / document picker backgrounds the app** (Android always, iOS sometimes) — the exported file must still exist when the receiving app reads it; the background purge must leave `cache/export/` alone. Test in Task 3.
2. **User picks the wrong file to restore** (a PDF, a photo, an empty file, a truncated `.meb`) — clear "not a My Expenses Book backup" error; no row or page file changes. Test in Task 6.
3. **Restore fails midway** (page write throws on page 2, DB insert throws) — old rows and page files intact, newly written page files removed. Test in Task 6.
4. **CSV with hostile or messy text** — commas, quotes, newlines in notes, non-Latin merchants, a merchant starting `=`/`+`/`-`/`@` (spreadsheet formula injection). Test in Task 1.
5. **Merging an archive made under a different home currency** — imported rows keep their `home_currency_at_save`; totals count them as unconverted until `reconvertAll` runs, never adding foreign home amounts. Test in Task 6.

---

### Task 1: CSV export (pure)

**Files:**
- Create: `src/export/rows.ts`, `src/export/csv.ts`
- Test: `src/export/rows.test.ts`, `src/export/csv.test.ts`

**Interfaces:**
- Consumes: `listReceipts(db, filter, { limit })`, `ReceiptFilter` (`receiptQueries.ts`); `listCategories(db)`, `listFolders(db)`; `fromMinor`.
- Produces:
  - `type ExportRow = { id: string; date: string /* YYYY-MM-DD */; time: string /* HH:mm or "" */; timezone: string; merchant: string; category: string; folder: string; currency: string; total: string; tax: string; homeCurrency: string; homeAmount: string; fxRate: string; fxRateDate: string; fxApproximate: boolean; notes: string; refNo: string; receipt: Receipt }`
  - `loadExportRows(db: AppDb, filter: ReceiptFilter, categoryLabel: (c: Category) => string): ExportRow[]` — pages through `listReceipts` in chunks of 500 until exhausted; category/folder names resolved once (deleted folder/category → `""`).
  - `CSV_COLUMNS: readonly (keyof ExportRow)[]` = `["date","time","timezone","merchant","category","folder","currency","total","tax","homeCurrency","homeAmount","fxRate","fxRateDate","fxApproximate","notes","refNo","id"]`
  - `toCsv(rows: ExportRow[], header: (col: keyof ExportRow) => string): string`

- [ ] **Step 1: Write failing tests**
  - `rows.test.ts` (testDb, synthetic receipts): `loadExportRows` returns confirmed live rows only, newest first; 1,201 receipts come back complete (crosses chunk boundary); `total` is `fromMinor` (`"12500"` IDR, `"4.50"` USD); `homeAmount` is `""` when `amountHomeMinor` is null; deleted folder → `folder: ""`; filter `{ folderId }` and `{ from, to }` narrow the rows.
  - `csv.test.ts`:
    - output starts with `"﻿"`, lines end `"\r\n"`, header row uses `header(col)` in `CSV_COLUMNS` order;
    - `merchant: 'Café "Le, Nord"'` → `"Café ""Le, Nord"""`; notes with `\n` are quoted and keep the newline;
    - formula guard on text columns (`merchant, category, folder, notes, refNo`): `"=HYPERLINK(1)"` → `"'=HYPERLINK(1)"`, same for leading `+ - @ \t \r`; numeric columns are NOT prefixed (a negative `total` `"-3.00"` stays `-3.00`);
    - `fxApproximate` true → `"yes"`, false → `""`;
    - `"東京ラーメン"` round-trips unchanged.

- [ ] **Step 2: Run** `npx jest src/export` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** `rows.ts` and `csv.ts` per Interfaces. `time` is `purchasedAtLocal.slice(11, 16)` (empty when the local string has no time).
- [ ] **Step 4: Run** `npx jest src/export && npx tsc --noEmit` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(export): CSV rows and writer`

### Task 2: PDF report

**Files:**
- Create: `src/export/reportHtml.ts`, `src/export/pdf.ts`
- Modify: `src/images/store.ts` (add `readPlain`), `src/images/store.test.ts`
- Test: `src/export/reportHtml.test.ts`
- Deps: `npx expo install expo-print`

**Interfaces:**
- Consumes: `ExportRow` (Task 1); `sumHome`, `monthTotals`; `formatMoney`, `monthLabel` (`src/receipts/format.ts`); `listPages`.
- Produces:
  - `ImageStore.readPlain(path: string): Promise<Uint8Array>` — validates with `assertPagePath`, decrypts in memory, writes nothing to disk.
  - `type ReportInput = { title: string; rangeLabel: string; generatedAt: string; home: string; locale: string; total: HomeTotal; months: { label: string; total: HomeTotal; rows: { row: ExportRow; thumbDataUri: string | null }[] }[]; byCategory: { label: string; homeMinor: number }[]; t: (key: string, opts?: object) => string }`
  - `buildReportHtml(input: ReportInput): string`
  - `renderPdf(html: string, outUri: string): Promise<string>` — `Print.printToFileAsync({ html })`, then move the result to `outUri` (inside `cache/export/`), returns `outUri`.
  - `buildReportInput(deps: { db; store: ImageStore; filter; home; locale; t; includeThumbs: boolean; title; rangeLabel; now: Date }): Promise<ReportInput>` — thumbnails via `readPlain(thumbPath)` of page 0 → `data:image/jpeg;base64,…`; `byCategory` sums only converted rows (same rule as `sumHome`).

- [ ] **Step 1: Write failing tests**
  - `store.test.ts`: `readPlain` returns the original bytes; rejects `"../x.enc"`; no file written under `cacheDir`.
  - `reportHtml.test.ts`: merchant `<script>alert(1)</script>` appears escaped (`&lt;script&gt;`); HTML contains no `http`; the grand total renders via `formatMoney`; `total.unconverted = 2` renders the "2 not converted" string and that row's home cell shows `—`; `fxApproximate` rows carry the `≈` mark; `thumbDataUri: null` renders no `<img>`; month sections appear in input order.
- [ ] **Step 2: Run** `npx jest src/export src/images` — Expected: FAIL.
- [ ] **Step 3: Implement.** Report layout (my call, A4 portrait, system font stack, inline CSS): header (title, range, generated date, home currency), summary box (home total, receipt count, not-converted count), per-category table, then per-month tables (thumb 48px · date · merchant · category · original amount · home amount). `@page { margin: 16mm }`, rows `break-inside: avoid`.
- [ ] **Step 4: Run** `npx jest && npx tsc --noEmit` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(export): PDF report HTML and renderer`

### Task 3: Export screen, file lifecycle, entry points

**Files:**
- Create: `src/export/files.ts`, `src/export/ExportScreen.tsx`, `src/export/presets.ts`, `src/app/(modals)/export.tsx`
- Modify: `src/images/ImageStoreProvider.tsx` (cold-start purge of export + picker dirs), `src/app/(tabs)/settings.tsx` (rows "Export" and "Backup & restore" — the latter pushes Task 7's `/backup` via `as unknown as Href`, as M3 Ruling A1/B5 did; tests assert only the push target), `src/organize/CollectionScreen.tsx` (header "Export" action), 4 locale files
- Test: `src/export/files.test.ts`, `src/export/presets.test.ts`, `src/export/ExportScreen.test.tsx`
- Deps: `npx expo install expo-sharing`

**Interfaces:**
- Consumes: Tasks 1–2; `taxYearRange`, `taxYearOf` (`src/taxYear/taxYear.ts`); `FileOps` (`src/images/store.ts`); `DateField`, `FolderPicker`.
- Produces:
  - `EXPORT_DIR = "export/"` (under `cacheDir`); `exportFileName(kind: "csv" | "pdf" | "meb", localDate: string): string` → `MyExpensesBook-2026-11-07.csv`, `MyExpensesBook-2026-11-07.pdf`, `MyExpensesBook-backup-2026-11-07.meb`
  - `purgeExportFiles(fs: FileOps): Promise<void>` — removes `cache/export/` and `cache/DocumentPicker/`
  - `shareFile(uri: string, kind: "csv" | "pdf" | "meb"): Promise<void>` — `Sharing.shareAsync` with mime `text/csv` / `application/pdf` / `application/octet-stream`, UTI `public.comma-separated-values-text` / `com.adobe.pdf` / `public.data`
  - `type RangePreset = "thisTaxYear" | "lastTaxYear" | "thisMonth" | "lastMonth" | "all" | "custom"`; `presetRange(p: RangePreset, today: string, taxStartMonth: number): { from?: string; to?: string }`
  - Route `/(modals)/export` params: `folderId?: string`, `from?: string`, `to?: string` (Collection passes folder id, or the tax year's `taxYearRange`)

- [ ] **Step 1: Write failing tests**
  - `files.test.ts`: file names above; `purgeExportFiles` removes both dirs via fake `FileOps`.
  - `presets.test.ts` (today `2026-11-07`): `thisTaxYear` start 1 → `2026-01-01..2026-12-31`; start 4 → `2026-04-01..2027-03-31`; `lastMonth` → `2026-10-01..2026-10-31`; `all` → `{}`.
  - `ExportScreen.test.tsx` (testDb + mocked `expo-sharing`, `expo-print`): shows count and home total for the selection (via `sumHome`); zero matches disables the Export button and shows the empty copy; CSV export writes to `cache/export/MyExpensesBook-<date>.csv` then calls `shareAsync` with `text/csv`; params `folderId` preselect the folder; a write failure shows the error panel and does not call `shareAsync`.
  - Review Focus 1, in `ImageStoreProvider` test or a `purgePolicy` test: an AppState `background` purge leaves `cache/export/` files in place; a cold-start mount removes them.
- [ ] **Step 2: Run** `npx jest src/export src/images` — Expected: FAIL.
- [ ] **Step 3: Implement.** Screen sections: Range (preset `OptionRow`s, `custom` shows two `DateField`s), Folder (Any / FolderPicker), Format (CSV / PDF; PDF shows "Include receipt images" toggle, default on), summary line, Export button with busy state. Before writing: `purgeExportFiles`. PDF title = folder name or "Expense report"; range label from preset.
- [ ] **Step 4: Run** `npx jest && npx tsc --noEmit && npm run check:pii` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(export): export screen, sharing and entry points`

### Task 4: Archive container and KDF (pure)

**Files:**
- Create: `src/backup/container.ts`, `src/backup/kdf.ts`, `src/backup/errors.ts`
- Test: `src/backup/container.test.ts`, `src/backup/kdf.test.ts`

**Interfaces:**
- Consumes: `encryptBytes`, `decryptBytes`, `ImageDecryptError` (`src/images/crypto.ts`); `randomBytes`, `scrypt` (quick-crypto).
- Produces:
  - Errors: `ArchiveFormatError` (not a MEBA file / bad framing / truncated), `ArchiveVersionError` (format or schema newer than this app), `WrongPassphraseError`, `ArchiveIncompleteError` (manifest pages missing).
  - `interface ByteSink { write(b: Uint8Array): Promise<void>; close(): Promise<void> }`; `interface ByteSource { read(n: number): Promise<Uint8Array> /* fewer bytes only at EOF */; close(): Promise<void> }`
  - `type KdfParams = { name: "scrypt"; N: number; r: number; p: number; salt: string /* hex */ }`; `DEFAULT_KDF = { N: 32768, r: 8, p: 1 }`; `MIN_PASSPHRASE = 8`
  - `deriveArchiveKey(passphrase: string, params: KdfParams): Promise<Uint8Array>` — `passphrase.normalize("NFC")`, async `scrypt`, keylen 32, `maxmem: 64 * 1024 * 1024`
  - `type ArchiveHeader = { format: 1; encrypted: boolean; kdf?: KdfParams }`
  - `createArchiveWriter(sink: ByteSink, opts: { passphrase: string | null }): Promise<{ manifest(m: object): Promise<void>; snapshot(json: object): Promise<void>; page(name: string, bytes: Uint8Array): Promise<void>; finish(): Promise<void> }>`
  - `openArchive(source: ByteSource): Promise<{ header: ArchiveHeader; unlock(passphrase: string | null): Promise<ArchiveReader> }>`; `ArchiveReader = { manifest(): Promise<object>; snapshot(): Promise<object>; pages(): AsyncIterable<{ name: string; bytes: Uint8Array }> }`

Byte layout (all integers big-endian):
```
file    := "MEBA" u8(1) u32(headerLen) headerJSON(utf8) record*
record  := u8(type) u32(len) payload            type: 1 manifest, 2 snapshot, 3 page
payload := encrypted ? encryptBytes(key, plain) : plain
page plain := u16(nameLen) name(utf8) bytes
```
- Records appear in order manifest, snapshot, pages. `len > 64 MiB` → `ArchiveFormatError`.
- The manifest is `{ createdAt, appVersion, schemaVersion, pageNames: string[], counts }`. After the last page, the reader checks every `pageNames` entry arrived, else `ArchiveIncompleteError`. Page names must match `/^[A-Za-z0-9-]+\.enc$/`.
- A failed GCM auth on the **manifest** record → `WrongPassphraseError`; on any later record → `ArchiveFormatError`.
- Strings via `Buffer.from(s, "utf8")` / `buf.toString("utf8")` (quick-crypto's global `Buffer`).

- [ ] **Step 1: Write failing tests** (in-memory `ByteSink`/`ByteSource` helpers in the test file)
  - round-trip encrypted and unencrypted: manifest, snapshot and 3 pages (bytes equal, order kept);
  - wrong passphrase → `WrongPassphraseError`; `"pässwörd"` in NFD unlocks an archive written with NFC;
  - first 4 bytes `%PDF` → `ArchiveFormatError`; empty source → `ArchiveFormatError`; file cut mid-page → `ArchiveFormatError`; one flipped byte inside page 2 ciphertext → `ArchiveFormatError`;
  - header `format: 2` → `ArchiveVersionError`; manifest lists 3 pages, archive holds 2 → `ArchiveIncompleteError`;
  - unencrypted archive: header JSON `encrypted: false`, no `kdf`; encrypted: header carries salt (32 hex chars) and params, and plaintext manifest text does NOT appear in the file bytes;
  - `kdf.test.ts`: same passphrase + salt → same 32-byte key; different salt → different key.
- [ ] **Step 2: Run** `npx jest src/backup` — Expected: FAIL.
- [ ] **Step 3: Implement** per byte layout.
- [ ] **Step 4: Run** `npx jest src/backup && npx tsc --noEmit` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(backup): MEBA archive container and scrypt KDF`

### Task 5: Snapshot and backup export

**Files:**
- Create: `src/backup/snapshot.ts`, `src/backup/exportBackup.ts`, `src/backup/expoBytes.ts`
- Modify: `src/db/types.ts` (add `LineItem`)
- Test: `src/backup/snapshot.test.ts`, `src/backup/exportBackup.test.ts`

**Interfaces:**
- Consumes: Task 4; `ImageStore.readPlain`; schema tables; `PrefsStore`.
- Produces:
  - `SCHEMA_VERSION: number` = number of entries in `src/db/migrations/meta/_journal.json` (import the JSON).
  - `type Snapshot = { schemaVersion: number; prefs: { homeCurrency: string | null; taxYearStartMonth: number }; categories: Category[]; folders: Folder[]; receipts: Receipt[]; receiptPages: ReceiptPage[]; lineItems: LineItem[] }` (add `LineItem` type to `src/db/types.ts`)
  - `snapshotSchema` (zod) — one strict object per table; a test asserts each zod object's keys equal `Object.keys(getTableColumns(table))`, so a future column fails the test until the schema (and an `.optional()` for older archives) is added.
  - `collectSnapshot(db: AppDb, prefs: PrefsStore): Snapshot` — every row of every table, soft-deleted included.
  - `fileOpsSink(uri: string): ByteSink`, `fileSource(uri: string): ByteSource` in `expoBytes.ts` (`File.open()` → `FileHandle.writeBytes/readBytes`); not unit-tested (thin adapter, device-verified in Task 9).
  - `exportBackup(deps: { db; prefs; store: ImageStore; sink: ByteSink; passphrase: string | null; now: number; appVersion: string; onProgress?: (done: number, total: number) => void }): Promise<{ pages: number; missing: string[] }>` — page set = distinct `imagePath`/`thumbPath` of non-deleted pages; a path whose file is missing is skipped and reported in `missing` and `manifest.missing` (backup still succeeds); page record name = path without `pages/`.

- [ ] **Step 1: Write failing tests**
  - `snapshot.test.ts`: soft-deleted receipt present with `deletedAt`; default categories present; zod parse of `collectSnapshot` output succeeds; zod-keys-vs-columns assertion for all 5 tables; a snapshot with a receipt missing `currency` fails parse.
  - `exportBackup.test.ts` (testDb + fake `ImageStore` + memory sink): archive reopens with the passphrase and yields the same snapshot and page bytes; two pages sharing one `imagePath` (split receipt) produce one page record; deleted page's files are not included; a missing file is reported in `missing` and the archive still opens; `onProgress` reaches `(total, total)`.
- [ ] **Step 2: Run** `npx jest src/backup` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx jest && npx tsc --noEmit` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(backup): snapshot and archive export`

### Task 6: Restore (replace and merge)

**Files:**
- Create: `src/backup/applySnapshot.ts`, `src/backup/importBackup.ts`
- Modify: `src/images/store.ts` (add `importPage`)
- Test: `src/backup/applySnapshot.test.ts`, `src/backup/importBackup.test.ts`

**Interfaces:**
- Consumes: Tasks 4–5; `findDuplicates(db, r, pageHashes)` (`src/capture/duplicates.ts`); `reconvertAll(db, home, cache)` (`src/fx/reconvert.ts`); `listAllPagePaths`; `ImageStore.cleanupOrphanPages`, `deleteFiles`; `notifyDataChanged`.
- Produces:
  - `ImageStore.importPage(plain: Uint8Array): Promise<string>` — encrypts with the device image key to a fresh `pages/<uuidv7>.enc`, returns the relative path.
  - `type RestoreMode = "replace" | "merge"`
  - `type MergeResult = { inserted: number; updated: number; kept: number; insertedReceiptIds: string[] }`
  - `applyReplace(db: AppDb, s: Snapshot): void` and `applyMerge(db: AppDb, s: Snapshot): MergeResult` — each one transaction, tables in order categories, folders, receipts, receiptPages, lineItems, inserts chunked 200 rows, ending with the FTS `rebuild`. Merge rule C4.
  - `importBackup(deps: { db; prefs; store: ImageStore; source: ByteSource; passphrase: string | null; mode: RestoreMode; onProgress? }): Promise<{ result: MergeResult; possibleDuplicates: { receiptId: string; matchId: string }[] }>`

Order inside `importBackup` (this order is the data-safety guarantee):
1. `openArchive` → `unlock` → manifest; `manifest.schemaVersion > SCHEMA_VERSION` → `ArchiveVersionError`.
2. Snapshot → `snapshotSchema.parse` (failure → `ArchiveFormatError`).
3. For each page record: `importPage(bytes)`, record `name → newPath`. Track new paths.
4. Rewrite `imagePath`/`thumbPath` in snapshot pages through the map (a path with no page record keeps its value; its row stays and shows the existing "image unavailable" state).
5. `applyReplace` or `applyMerge`.
6. On any throw in 1–5: `store.deleteFiles(newPaths)`, rethrow. Nothing else was changed.
7. After commit: `store.cleanupOrphanPages(listAllPagePaths(db))` (removes replaced/losing files); replace mode sets prefs per C5; `reconvertAll(db, prefs.get("homeCurrency"), prefs.get("fxTables"))`; merge mode computes `possibleDuplicates` for `insertedReceiptIds` that are confirmed and live, keeping only matches whose `matchId` is not itself in `insertedReceiptIds`; `notifyDataChanged()`.

- [ ] **Step 1: Write failing tests**
  - `applySnapshot.test.ts`: replace leaves exactly the snapshot rows (local-only receipt gone) and FTS search finds an imported merchant; merge inserts new ids, updates when snapshot `updatedAt` is newer, keeps local when older, keeps local on full tie; soft-deleted snapshot row with newer `updatedAt` soft-deletes the local row; default categories (same ids) are not duplicated; 450 receipts cross the chunk size.
  - `importBackup.test.ts` (testDb + fake store tracking files):
    - round trip: export from DB A → import replace into empty DB B → rows equal (except page paths) and page bytes equal through `readPlain`;
    - wrong passphrase → `WrongPassphraseError`, DB B unchanged, no new page files;
    - Review Focus 2: source bytes of a fake PDF / empty / truncated `.meb` → `ArchiveFormatError`, rows and files unchanged;
    - Review Focus 3: fake store `importPage` throws on the 2nd page → error; the 1st new file is deleted; old rows and files intact. Also a snapshot that fails zod → same guarantee;
    - Review Focus 5: archive with receipts saved under home `EUR` merged into a DB with home `IDR` → after import `sumHome(db, {}, "IDR").unconverted` counts them (with an empty FX cache), and their `amountHomeMinor` is never added to `homeMinor`;
    - merge with an imported receipt matching a local one by `refNo` → one `possibleDuplicates` entry;
    - archive `schemaVersion` = `SCHEMA_VERSION + 1` → `ArchiveVersionError`;
    - replace sets `homeCurrency`/`taxYearStartMonth` from the archive; merge leaves them.
- [ ] **Step 2: Run** `npx jest src/backup` — Expected: FAIL.
- [ ] **Step 3: Implement** in the order above.
- [ ] **Step 4: Run** `npx jest && npx tsc --noEmit` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(backup): restore by replace or merge`

### Task 7: Backup & restore screen

**Files:**
- Create: `src/backup/BackupScreen.tsx`, `src/backup/passphrase.ts`, `src/app/backup.tsx`
- Modify: 4 locale files
- Test: `src/backup/BackupScreen.test.tsx`, `src/backup/passphrase.test.ts`
- Deps: `npx expo install expo-document-picker`

**Interfaces:**
- Consumes: Tasks 3–6 (`exportFileName`, `purgeExportFiles`, `shareFile`, `fileOpsSink`, `fileSource`, `exportBackup`, `openArchive`, `importBackup`, errors).
- Produces:
  - `validatePassphrase(p: string, confirm: string): "ok" | "tooShort" | "mismatch"` (length counted on the NFC form, `MIN_PASSPHRASE`)
  - Route `/backup` (stack screen, header title "Backup & restore")

Screen behavior:
- **Back up:** last backup line ("Last backup: <date>" / "Never backed up"); passphrase + confirm fields (`secureTextEntry`, `autoComplete="off"`); "Back up now" → `purgeExportFiles` → write `cache/export/<exportFileName("meb")>` → `shareFile(uri, "meb")` → on resolve set `lastBackupAt`, `receiptsSinceBackup = 0` (C8). "Back up without passphrase" link → `Alert`: "Without a passphrase, anyone who gets this file can see your receipts. If you lose the passphrase you choose instead, the backup can't be opened. Continue without one?" [Cancel] [Continue without passphrase (destructive)]. Progress `done/total` pages while writing.
- **Restore:** "Restore from backup" → `DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true })` → `openArchive`; `ArchiveFormatError` → "This file isn't a My Expenses Book backup." If `header.encrypted`, ask the passphrase (wrong → inline "Wrong passphrase", retry allowed). Then choose: **Merge** ("Add receipts from the backup; keep what's here") or **Replace** → `Alert`: "Replace everything on this device with the backup? Receipts not in the backup will be deleted. This can't be undone." [Cancel] [Replace (destructive)]. Result card: "Added N, updated M"; if `possibleDuplicates.length`, a list "Possible duplicates (K)" whose rows open `/document/[id]`. The picked copy is deleted when the screen leaves the restore flow (success or failure).
- The passphrase lives in component state only and is cleared after each export/import attempt.

- [ ] **Step 1: Write failing tests**
  - `passphrase.test.ts`: `"1234567"` → `tooShort`; `"12345678"`/`"12345679"` → `mismatch`; NFC/NFD forms of the same 8-char word → `ok`.
  - `BackupScreen.test.tsx` (mocks: `expo-sharing`, `expo-document-picker`, Task 5/6 functions via `jest.mock`): mismatch disables "Back up now"; successful share sets `lastBackupAt` and zeroes `receiptsSinceBackup`; share rejection leaves both prefs unchanged and shows an error; skip-passphrase path shows the Alert and only proceeds on Continue; picker cancel does nothing; `ArchiveFormatError` shows the not-a-backup copy; `WrongPassphraseError` shows inline retry; Replace requires the Alert confirm; result shows duplicate rows that navigate to `/document/<id>`.
- [ ] **Step 2: Run** `npx jest src/backup` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx jest && npx tsc --noEmit && npm run check:pii` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(backup): backup and restore screen`

### Task 8: Backup reminder

**Files:**
- Create: `src/backup/reminder.ts`, `src/backup/BackupReminder.tsx`
- Modify: `src/prefs/prefs.ts` (add `backupReminderSnoozedUntil: number | null`, default `null`), `src/review/useReviewForm.ts` (increment on create-confirm, not on edit), `src/app/(tabs)/index.tsx` (banner under the drafts banner), 4 locale files
- Test: `src/backup/reminder.test.ts`, `src/backup/BackupReminder.test.tsx`, `src/review/useReviewForm.test.tsx`

**Interfaces:**
- Produces: `BACKUP_REMINDER_EVERY = 20`, `SNOOZE_MS = 7 * 24 * 3600 * 1000`; `shouldRemindBackup(p: { receiptsSinceBackup: number; backupReminderSnoozedUntil: number | null }, now: number): boolean`

- [ ] **Step 1: Write failing tests**
  - `reminder.test.ts`: 19 → false; 20 → true; 20 with snooze in the future → false; snooze in the past → true.
  - `useReviewForm.test.tsx`: confirming a draft increments `receiptsSinceBackup` by 1; saving in edit mode does not; a failed save does not.
  - `BackupReminder.test.tsx`: renders "20 receipts since your last backup" with [Back up] → `/backup` and [Later] → sets snooze `now + SNOOZE_MS` and hides.
- [ ] **Step 2: Run** `npx jest src/backup src/review` — Expected: FAIL.
- [ ] **Step 3: Implement.** The increment happens after the save transaction commits.
- [ ] **Step 4: Run** `npx jest && npx tsc --noEmit` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(backup): backup reminder`

### Task 9: Device build and acceptance doc

**Files:**
- Create: `docs/m4-acceptance.md` (same structure as `docs/m3-acceptance.md`)
- Modify: `docs/m3-followups.md` only if a carry-over is resolved

Three new native modules require a new dev build. Following Ruling A3 (M3), run ONE Android EAS dev build on the personal account `gia-terhubung` — **ask the owner before starting it** (it spends build quota).

- [ ] **Step 1:** `npx expo-doctor` and `npx expo prebuild --clean --no-install` dry run compile check pass (do not commit `android/`/`ios/` if gitignored).
- [ ] **Step 2:** After owner approval, `eas build --profile development --platform android`; record build id and result in `docs/m4-acceptance.md`.
- [ ] **Step 3:** Write OWNER-PENDING device rows (Redmi R*, iPhone P*, Z Flip F*), each with expected result:
  - CSV export of a tax year opens in Google Sheets / Numbers with correct columns, accents, and no formula execution.
  - PDF report opens, thumbnails visible, totals match the Folders/tax-year screen.
  - Share sheet → Files/Drive save works; returning to the app does not lose the screen state; with lock timeout "Immediately" the lock screen shows and returns to the export screen.
  - Backup with passphrase → erase all local data → onboarding → restore replace → receipts, images, folders, categories, home currency back; wrong passphrase rejected.
  - Backup without passphrase shows the warning.
  - Merge import of a backup from a second device adds receipts and lists possible duplicates.
  - Picking a non-backup file shows the not-a-backup message.
  - Reminder banner appears after 20 confirmed receipts; Later hides it.
  - Privacy: proxy session during export + backup shows only the FX host.
  - Fold/unfold (Z Flip) on the export and backup screens keeps the selected range, format and typed passphrase.
- [ ] **Step 4:** Commit `docs(m4): acceptance checklist and build status`.
