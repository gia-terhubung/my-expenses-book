# M4 follow-ups

Carried out of the M4 (export & backup) subagent-driven run, branch `feat/m4-export-backup`.
Final review: merge with fixes → one fix wave (see git log after 81015d0).

## Must verify on owner devices (blocks M4 sign-off, not merge)

- Android EAS dev build with the new native deps (expo-print, expo-sharing, expo-document-picker): not run yet, awaiting owner approval.
- All OWNER-PENDING rows in `docs/m4-acceptance.md`. They are the first real test of the `expoBytes.ts` FileHandle adapter, the DocumentPicker path and the share sheet.
- PDF memory: a report with ≥500 receipts and images on the Redmi 14C (all thumbnails sit in one HTML string).
- Backup reminder banner spacing under the drafts banner.

## Known limits / upgrade paths

- **Strict snapshot schema.** The first migration that adds a column must add the field to `snapshotSchema` as `.optional()` (older backups lack it). A data-transform migration needs a matching snapshot transform. The frozen fixture `src/backup/fixtures/snapshot-v4.json` and its test must keep passing.
- **Merge rule is per row (C4)**, not per receipt. A snapshot page or line item can win while its parent receipt loses, which mixes children. Deletions propagate: merging an old backup does not undo a newer local delete.
- **Snapshot is one record** capped at 64 MiB (`MAX_RECORD`). A very large DB (OCR text included) would fail backup with "Record too large".
- **No AAD / header authentication** in the container. This is not exploitable today (reviewed). A forged unencrypted archive restores with no passphrase prompt, so the UI labels unencrypted backups.

## Deferred minor findings
- Task 1: IDR fixture "12500" in csv.test.ts misleading; no deleted-category → "" test; `as Partial<NewReceiptInput>` casts in rows.test.ts; formula-guard test counts substrings loosely
- Task 2: sequential listPages+readPlain per row; "no http" test input lacks a thumbnail; pdf.ts temp-delete catch silent; renderPdf catch path untested
- Task 3: custom range from > to shows "No receipts match"; no Sharing.isAvailableAsync; a share rejection is shown as an export failure; thumbFailures notice untested; error state drops the Back button; provider test mocks purgeExportFiles
- Task 4: writer validation errors typed as ArchiveFormatError or untyped Error; page-name length unbounded vs u16; one successful unlock per handle (undocumented); close-ownership test tautological; Rec type duplicated
- Task 5: filler assertion exportBackup.test.ts; keys-vs-columns test binds names only (enum literal drift possible); expoBytes create+Truncate redundant; malformed imagePath aborts export (undocumented)
- Task 6: redundant manifest cast in importBackup
- Task 7: ErrorPanel early return outside the 560 wrapper, and Retry only dismisses
- Task 8: Date.now read at render (snooze expiry needs a re-render); snooze test uses the real clock
- Final: "Restored N" / "Added N" count drafts and soft-deleted rows too

## Controller rulings
(see final message of the run; copied here)
| T4→T5 | createArchiveWriter.manifest(m: object); T5 adds manifest.missing beyond T4's listed fields | Ruling P1 |
| T3 self | creates files.ts/presets.ts/ExportScreen; Review Focus 1 test target "ImageStoreProvider test or purgePolicy test" | Ruling P2 |
- Ruling P1: manifest is an open JSON object; reader requires only pageNames (string[]) and schemaVersion (number); extra keys (missing, counts) allowed — why: T5 adds `missing` — cost if wrong: none.
- Ruling P2: Review Focus 1 test lives in a new pure helper test if ImageStoreProvider is hard to render; implementer picks, but must assert both: background purge leaves cache/export/, cold-start mount removes it — cost if wrong: none.
Task 1: Ruling: brief said IDR fromMinor "12500"; ISO 4217 IDR exponent is 2 (currency table) so "125.00" is correct; implementer tested 0-decimal via JPY — plan example error — cost if wrong: none
Task 2: dispatched (base 7241ad9, implementer sonnet a785c54ebc722a8fe). Ruling: brief omits locale files; new report strings go to export.report.* in all 4 locales, reuse totals.notConverted — cost if wrong: none
Task 3: dispatched (base a48b46f, implementer sonnet af18814bf7ed4838d). Ruling: PDF with thumbFailures>0 still shares + non-blocking notice — why: partial report better than none, user informed — cost if wrong: copy tweak
Task 4: dispatched (base 284e9c1, implementer sonnet a14f8f2ff181a0043). Rulings carried: P1; writer enforces record order + rejects short passphrase; unlisted/duplicate page → ArchiveFormatError — cost if wrong: none
Task 4: Ruling: schemaVersion-vs-app check belongs to Task 6 importBackup (step 1), not the container — cost if wrong: none
Task 5: dispatched (base f7f7c0f, implementer sonnet a935759748049effd). Ruling: exportBackup pre-checks file existence (new ImageStore.exists) so manifest.pageNames lists only existing files; a mid-write readPlain failure aborts the backup (sink closed, throw) instead of a silently incomplete archive — why: T4 finish() completeness + data safety — cost if wrong: one corrupt page blocks backups until fixed (user sees error)
Task 6: Ruling: pages() consumed fully before DB transaction (reader detects incompleteness only at end) — cost if wrong: none
Task 6: Ruling: MergeResult counts receipts only (user-facing numbers) — cost if wrong: copy says "receipts" anyway
Task 6: Ruling: post-commit steps (cleanup, prefs, reconvert, duplicates, notify) never reject importBackup; errors logged in __DEV__ — why: data already committed, rejecting would mislead user into retrying — cost if wrong: orphan files linger until next cleanup
Task 7: Ruling: restore refused while captureLease.held() — why: post-commit cleanup would delete unrecorded capture pages (T6 concern) — cost if wrong: user told to finish scan first
Task 7: Ruling: unencrypted backup shows "isn't protected by a passphrase" note before Merge/Replace (T4 minor: forged unencrypted archive restores w/o prompt) — cost if wrong: one extra line
Task 7: Ruling: ArchiveVersionError → "update the app" copy; ArchiveIncompleteError → "damaged or incomplete" copy; partial .meb deleted on export failure; useRef in-flight guard (T3 minor applied here) — cost if wrong: copy tweaks
Task 9: Ruling: steps 1 + 3 (doctor/prebuild check, acceptance doc) run now; step 2 EAS build waits for owner approval at finish — why: spends build quota (outside-repo side effect) — cost if wrong: build delayed until owner says go
Task 9: Ruling: doc-only task (docs/m4-acceptance.md) reviewed inside the final whole-branch review instead of a separate task review — cost if wrong: doc errors caught later
- Final: Ruling: keep C4 merge rule (last-write-wins incl. deletions — same rule future sync uses) and reword mergeHint to say so — cost if wrong: owner prefers "never apply backup deletions" → change applyMerge + copy
- Final: Ruling: forward compat via frozen v4 fixture test + "older version" error on schema-parse failure of older archives; real upgrade path deferred to first column-adding migration — cost if wrong: none now

## Found during the final fix wave
- Leaving the backup screen mid-backup / mid-restore is blocked with `usePreventRemove` (tested with mocks only): verify Android back, the header back button and the iOS swipe on device during a restore.
- Capture is refused while the restore lease is held (feed add button and the capture route). If a restore starts between the picker returning and the capture route starting, the capture route backs out and the picked photos / scanned pages are dropped; the user picks again.
- Backup buttons are disabled only while a picked backup is open (passphrase / choose stages), not on the "done" result, since the picked file is already deleted by then.
- Cold-start purge assumes expo-print writes under `cache/Print/` (Android). Check the iOS temp location on device; a leftover plaintext PDF there would survive the purge.
- `ArchiveTooOldError` is chosen for any snapshot-validation failure of an archive with an older `schemaVersion`, so a damaged older archive also reads as "made by an older version".
