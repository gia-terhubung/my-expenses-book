# M2 follow-ups

Carried out of the M2 (capture & parse) subagent-driven run, branch `feat/m2-capture-parse`.
Final review: merge with fixes → one fix wave (8fa4939, 92e9334, 7600f40, c7ba0e7) → re-review: ready to merge, I1–I4 addressed.

## Must verify on owner devices (blocks M2 sign-off, not merge)

- Rows A8, A15, I8 in `docs/m2-acceptance.md`: keyed POP of `/lock` must unmount on device, otherwise the app stays obscured and capture never starts.
- All other OWNER-PENDING rows in `docs/m2-acceptance.md` (Redmi 14C OCR check, iPhone 12 Pro build, Z Flip 6 AI path).

## Carry into M3

- DONE (6146d5a): Constraint: aggregates must sum only rows with `homeCurrencyAtSave == current home` AND `amountHomeMinor` non-null.
- DONE (1d87ae7, 6891d7e): Native date/time picker (Ruling AB; M2 uses validated text fields).
- DONE (bbf6f87): FX cache read-then-rewrite may clobber a concurrent `syncFx` update (cost: refetch).
- DONE (bbf6f87): New (final re-review): `capture.tsx` `cancelWork` doesn't set `left.current` before `router.back()`; abort resolving during dismiss can fire a second back. Fix: set `left.current = true` first.

## Deferred minor findings
- Task 1: minor (deferred): snapshot protection `.catch(() => {})` swallows failure; toggles not serialized
- Task 1: minor (deferred): `"/lock" as Href` cast until typed routes regenerate
- Task 1: minor (deferred): import order / long docstring in LockGate.tsx
- Task 1: minor (deferred): no test that LockGate calls applySnapshotProtection on lockEnabled change
- Task 1: minor (deferred): AppModal effect re-fires on inline onRequestClose while obscured (harmless)
- Task 1: minor (deferred): appModalGuard regex misses `import * as RN` / RN.Modal
- Task 2: minor (deferred): migrations.js header comment churn
- Task 2: minor (deferred): findReceiptsByAmount inclusive window edges untested
- Task 2: minor (deferred): createPage doesn't verify receiptId exists (no FK, matches convention)
- Task 3: minor (deferred): failure test doesn't check cleanup of written encrypted files / cache plaintext
- Task 3: minor (deferred): resetLocalData wipeImages optional → make required
- Task 3: minor (deferred): crypto.ts bare catch drops cause
- Task 3: minor (deferred): orphan sweep counts non-.enc entries/dirs
- Task 3: minor (deferred): resetLocalData doesn't clear cache plaintext dirs (next mount purge does)
- Task 3: minor (deferred): savePage holds extra in-memory copy of bytes
- Task 4: minor (deferred): `OCR_LANGUAGES` in src/ocr/languages.ts (file not in brief)
- Task 4: minor (deferred): "Copy report" is selectable text (no clipboard dep)
- Task 4: minor (deferred): Android decode up to ~2x 4096 cap (OCR input is the 1600px normalized image in pipeline, so low impact)
- Task 4: minor (deferred): Kotlin TextRecognizer lazy init unsynchronized
- Task 4: minor (deferred): dHash may differ by a few bits iOS vs Android (different downscalers); dhash.ts comment overstates parity
- Task 4: minor (deferred): Android OCR ignores mirrored EXIF while hash applies it
- Task 4: minor (deferred): iOS counts blank observations in rotation stats, Android skips
- Task 4: minor (deferred): ESLint NativeModule<{}> warnings (scaffold pattern)
- Task 5: minor (deferred): guard misses Title-case / mid-line-label names (manual pass covers)
- Task 5: minor (deferred): PII guard shape-masks amount-shaped numbers on both sides — a deliberately re-dotted 9-10 digit account would evade (raw/as-printed forms still caught); tighten to currency-marker or expected.json-based masking
- Task 5: minor (deferred): year mask strips first group of 20xx card-style numbers (remaining 12 digits still caught)
- Task 6: minor (deferred): `0.500` leading-zero special case undocumented
- Task 6: minor (deferred): no RED run on record
- Task 6: minor (deferred): Ruling N false joins (`Rp 10.000, 20 pcs`→10000.20, `TOTAL 12, 50`→12.50)
- Task 6: minor (deferred): `- Rp 5.000` (spaced) reads positive
- Task 6: minor (deferred): YMD branch fixed confidence 0.75, no short-year penalty; no test for `1, 00` non-join
- Task 6: minor (deferred): space-grouped `Rp 1 000 000` unsupported
- Task 7: minor (deferred): bare `$` → USD misses SGD/AUD without prefix; review screen must make currency easy to fix (Task 11)
- Task 7: minor (deferred): 3-segment split can separate EDC/POS pair with equal totals
- Task 7: minor (deferred): CJK date regex lacks digit lookbehind
- Task 7: minor (deferred): accuracy test can pass total with wrong currency of same exponent (Ruling L accepts)
- Task 7: minor (deferred): `Total Cash 20.000` / `Total Tunai` lines count as total at 0.85 (payment word as qualifier) — could beat lower-tier real total
- Task 7: minor (deferred): debit-only records with batal/cancel/return anywhere → null (conservative)
- Task 7: minor (deferred): pickTax double counts `TOTAL TAX` + `Total Sales Tax` lines
- Task 7: minor (deferred): NON_MONEY phoneLike drops Indian-style ₹1,23,456
- Task 8: minor (deferred): offline home-currency change nulls FX fields until next online mount (correct: old values were in old home currency)
- Task 8: minor (deferred): rateUrl doesn't validate base/date
- Task 8: minor (deferred): fxRate 12 decimals → ~7-8 significant digits for strong-vs-weak pairs (display only)
- Task 8: minor (deferred): 429/5xx date fetches not remembered nor treated as offline
- Task 8: minor (deferred): missingDates never pruned
- Task 8: minor (deferred): syncFx cancelled mid-loop discards fetched rates
- Task 8: minor (deferred): fresh offline install leaves same-currency receipts unconverted until first online pass (capture path converts same-currency directly)
- Task 8: minor (deferred): timeout test checks signal only, not abort firing
- Task 9: minor (deferred): very old LLM dates accepted
- Task 9: minor (deferred): timed-out native call not cancelled; Kotlin catch(Exception) swallows CancellationException
- Task 9: minor (deferred): missing tests for late-result/timer-clear, tax merge
- Task 9: minor (deferred): categoryId merge dead code (LLM schema has no category); zod runtime dep heavy for 5 fields
- Task 9: minor (deferred): unknown LLM currency dropped but its amounts parsed with home exponent (flag off)
- Task 9: minor (deferred): string-typed LLM amounts not MAX bounded
- Task 9: minor (deferred): merchant zero-width/bidi chars not stripped; slice may split surrogate pair
- Task 9: minor (deferred): Kotlin nullable client getter unsynchronized
- Task 9: minor (deferred): GenerativeModel.close() only seen in constant pool, signature unverified (EAS build in Task 12 compiles)
- Task 10: minor (deferred): FX cache read-then-rewrite may clobber concurrent syncFx update (cost: refetch)
- Task 10: minor (deferred): no render tests for capture.tsx / CaptureSheet
- Task 10: minor (deferred): allow-list doesn't reject `?`/`#` (defence in depth)
- Task 10: minor (deferred): rejected page in a group leaves allowed pages undeleted (unreachable in-app)
- Task 11: minor (deferred): "Check this"/errors not in accessible description; iOS doesn't announce errors
- Task 11: minor (deferred): flush reads prefs fxTables on every debounced write
- Task 11: minor (deferred): test reassigns global.fetch without restore
- Task 11: minor (deferred): closeViews drops cached view shared with split sibling (regenerated)
- Task 12: minor (deferred): A5/I11 compare same-device re-import only, not cross-platform hash
- Task 12: minor (deferred): "photo #21" assumes picker order
- Task 12: minor (deferred): ocr-check screen not run on device/sim

## Controller rulings (A–AG)

- Ruling A: T10 creates a placeholder `src/app/(modals)/review/[id].tsx` (shows draft id) so its navigation works; T11 replaces it — cost if wrong: trivial throwaway file.
- Ruling B: T11 adds the "Add manually" item to `src/capture/CaptureSheet.tsx` — cost if wrong: none.
- Ruling C: T11 may add `countPagesByImagePath(db, imagePath, excludeReceiptId)` to `src/db/repositories/pages.ts` (with test) — cost if wrong: one small repo fn.
- Ruling D: RN `Modal` must never be visible while locked or privacy-covered — add `src/components/AppModal.tsx` (RN Modal with `visible={visible && !obscured}`), expose obscured state from LockGate context, migrate settings.tsx, add a test that fails if any file under src/ imports `Modal` from "react-native" other than AppModal — why: fixes iOS "already presenting", Android Dialog-window-above-lock, and app-switcher leak in one place — cost if wrong: pickers close on lock (user reopens).
- Ruling E: Task 1 Imp3 (real modal + background/foreground flow on device) cannot be driven on headless sim (no tap tooling); moves to Task 12 acceptance + owner devices (iPhone 12 Pro, Redmi 14C, Z Flip 6) — cost if wrong: lock/modal bug found later on device.
- Ruling F: decrypted view cache is purged when AppState becomes 'background' (and on mount), not on iOS 'inactive' — inactive fires for Face ID prompts/system dialogs/picker and would yank a viewed image; snapshot protection covers the inactive snapshot — cost if wrong: decrypted cache file lives during brief inactive periods (app sandbox, still deleted on background).
- Ruling G: soft-deleted page files are swept as orphans at next launch (soft delete is final for images in v1; no trash) — cost if wrong: a future undo/trash feature must change the sweep to include soft-deleted rows.
- Ruling H: pull Task 3 minors into fix round 1: flaky ff-d8 test, sweep-before-savePage race, release() image refs (low-RAM Redmi), deleteFiles validate-all-first — cheap, privacy/memory/test-reliability.
- Ruling I (carry to Task 10): capture pipeline must hold a 'capture in progress' lease that makes the background purge skip cache/work/ while held, and must delete picker/scanner source files (cache/ImagePicker etc.) after savePage — Android picker/scanner activities background the app mid-capture — cost if wrong: failed captures or plaintext left in picker cache.
- Ruling I amended: the capture lease must make background purge skip cache/work/ AND cache/ImageManipulator/ for the whole savePage + OCR window — cost if wrong: same as Ruling I.
- Ruling J: add `expo-dev-client` (deviation from plan dep list) — required for `developmentClient: true` dev builds that owner devices need for dev screens; inert in store builds — cost if wrong: one extra dependency.
- Ruling K: rotation retry picks the pass by reading direction (first vs last glyph box), confidence only as tie-break — overrides brief's "higher mean confidence": on owner photo #21 confidence picked the reversed pass (1.000 vs 0.968) — cost if wrong: rotation heuristic misfires on other layouts (device test in Task 12).
- Ruling: EAS project @gia-terhubung/my-expenses-book created on personal account (approved earlier) — cost: none.
- Ruling L (carry to Task 7): expected.json amounts compared via toMinor(value, currency), not string equality; split fixtures carry `segments[]` (top-level = first segment); merchant compared loosely (case-insensitive contains) and merchant/category are reported, not part of the ≥85% gate (gate = total AND date) — cost if wrong: none (gate unchanged).
- Ruling M: pull Task 5 minors M1 (guard strips digit separators) + M3 (replace verbatim garbled J&T header lines in fixtures 22/24) into fix round 1 — privacy is the product promise, both cheap — cost if wrong: none.
- Ruling N: separator+space joins only when followed by exactly 3 digits (thousands group) or, as the final group, by exactly 2 digits after a decimal separator — keeps brief's `RP  1, 000, 000. 00→1000000` while `Rp 10.000, 20.000` stays two amounts — cost if wrong: rare OCR splits like `1, 00` not joined.
- Ruling O: pull Task 7 minors 1 (single-fixture keywords: remove unless general) and 2 (thread `today` through extractTotalValue) into fix round 1 — cheap, overfitting hygiene/determinism — cost if wrong: none (non-gated fields).
- Ruling P: negative amount may be total only if ALL amount candidates in the receipt are negative and its line has no refund/retur/void/diskon/discount/cashback/kembali/change word; then use absolute value at confidence 0.6 (review flags it) — bank/e-wallet debit screenshots show expenses as negatives — cost if wrong: a refund-only slip read as an expense (user sees low-confidence highlight).
- Ruling Q: accept `splitReceipts(lines, { today })` (deterministic clock) — Task 10 must pass today — cost: none.
- Ruling R: accept useFx background fetch of rates for up to 30 newest distinct foreign purchase dates (beyond brief) — spec wants purchase-date rates; only dates+codes go over the wire to the one allowed host — cost if wrong: up to 30 small requests on launch when online.
- Ruling S: pull Task 8 minors "fetch timeout/abort" and "extract testable syncFx" into fix round 1 — offline UX + Important #1 needs a test seam — cost: none.
- Ruling T: Task 10 sets `testTimeout: 30000` on the jest-expo project in jest.config.js — UI suites time out at 5 s under parallel load repeatedly — cost: slower failure detection.
- Ruling U: pull Task 9 M1 (validate LLM currency against CURRENCIES) and M2 (number-typed totals stringified via exponent; tax > total rejected) into fix round 1 — never-trust-LLM is the named risk — cost: none.
- Ruling V (Task 10): configure expo-image-picker plugin with photosPermission string, cameraPermission false, microphonePermission false (picker never uses camera; scanner handles capture) and block android.permission.RECORD_AUDIO; scanner plugin gets the iOS camera string — minimal permissions for privacy label — cost if wrong: permission prompt mismatch found in Task 12 device test.
- Ruling W: accept Analysis.pages (savePage inside analyzeCapture under the lease) instead of normalizedUris; CaptureDeps.fx = {get,set,fetchFn?} + lease + timeZone; Ruling T via setupFilesAfterEnv jest.setTimeout(30000) (testTimeout ignored in projects) — all serve rulings I/T — cost: none.
- Ruling X (carry to Task 11): manual/no-total drafts store total_minor 0 with total confidence 0 — review must treat confidence-0 total as missing (empty field, save blocked until entered).
- Ruling W confirmed formally for Task 11 consumers (Analysis.pages, CaptureDeps.fx accessor, lease, timeZone).
- Ruling Y: pull Task 10 M1 (skip "similar" pass when total 0 / conf 0), M2 (multi-import cancel: show already-created drafts; report failed photos), M3 (OCR_LANGUAGES inside try), and URI path normalization (file:// prefix, /private/var vs /var) in discardPlaintext into fix round 1 — correctness/privacy, cheap — cost: none.
- Ruling Z (carry to Task 11): Receipts tab shows a "Continue reviewing (N)" banner when non-deleted drafts exist, opening the review queue — drafts created then abandoned (left mid-run, app killed) must stay reachable — cost: small extra UI.
- Ruling AA: manual FX override (fxRateDate null, fxApproximate false) is preserved by reconvertAll while home currency unchanged; a home-currency change replaces it with the automatic rate — user intent wins until the basis changes — cost if wrong: manual rate lost on home change.
- Ruling AB: date/time are validated text fields in M2; native date picker (existing @expo/ui dep) deferred to M3 polish — cost: clunkier date entry.
- Ruling AC: accept softDeletePages on discard (shared split files deleted only when no live receipt references them) — cost: none.
- Ruling AD: pull Task 11 minors 1 (delete decrypted view file on discard), 2 (catch deleteFiles failure, still navigate), 5 (in-flight guard on save/goNext) + 3 (Save accessibilityLabel) into fix round 1 — user-facing privacy/stuck-screen/double-pop bugs, cheap — cost: none.
- Ruling AE: Task 12 makes ONE Android EAS development build (also first compile of Task 9 Kotlin); iOS physical build needs owner device registration (`eas device:create`, interactive) → owner step in checklist, not run by agent — cost: iPhone 12 Pro test waits on owner.
- Ruling AF: make the owner OCR check feasible on-device: (dev)/ocr-check gets selectionLimit 30 and an on-screen per-photo row "#n: total <amount|—> · date <YYYY-MM-DD|—> · <ms> ms · rot <deg>" (amount/date only, no merchant/names/raw text) plus a summary line (photos, total found, date found, median/max ms); "Copy summary" copies only summary + rows; raw text view stays behind a separate toggle with a "contains private text — don't paste" warning — cost: small dev-only code change in acceptance task.
- Ruling AG: ONE final fix wave covering I1-I4 + fix-before-merge minors (lock route removed by name not position; /lock deep link while unlocked redirects home; ocr-check per-photo timeout sharing I3 helper); I2 fix = keep existing conversion when no rate found for same home currency + fetch dates for receipts still needing conversion (cap 30 per pass) — corrects Ruling R — cost: none.
