# M3 follow-ups

Carried out of the M3 (organize) subagent-driven run, branch `feat/m3-organize`.
Final review: merge with fixes → one fix wave (5232d59..3feb869) → re-review: ready to merge (I1–I5, T8, T9, B6 addressed).
Android dev build fd79f317 (from bbf6f87): compile PASS, runtime OWNER-PENDING — see `docs/m3-acceptance.md`.

## Must verify on owner devices (blocks M3 sign-off, not merge)

- All OWNER-PENDING rows in `docs/m3-acceptance.md` (Redmi R1–R8, iPhone P1–P8, Z Flip F1–F8), plus the open M2 rows.
- R5/P5/F8: edit-mode Android back / iOS swipe must show "Discard changes?" (`usePreventRemove` only tested with mocks).
- P6: VoiceOver can operate the iOS date field (the wrapper View may hide it).
- iOS simulator evidence is BLOCKED (host simulator stalls at boot) — no screenshots exist.

## Parked at final review

- `docs/m3-acceptance.md` §1 still says 570 tests; HEAD has 582.
- Edit Save with no changes still writes and bumps `version`/`updated_at`.

## Deferred minor findings
- Task 1: minor (deferred): softDeleteReceipt notifies even when no row matched
- Task 1: minor (deferred): notify fires inside db.transaction (pipeline.ts, useReviewForm.ts) — pre-commit, once per row
- Task 1: minor (deferred): `substr(purchased_at_local,1,10) <= to` bypasses the new index; use `< nextDay` bound
- Task 1: minor (deferred): reconvertAll notify untested; long line receiptQueries.test.ts:384; per-write notify tests merged into one
- Task 2: minor (deferred): no guard for startMonth outside 1-12 / malformed date; missing tests startMonth 12/2 in taxYearRange; label unpadded outside 1000-9999
- Task 3: minor (deferred): `requested` count stale across filter A→B→A; hasMore true at exact-limit (extra empty fetch; fetch limit+1); ReceiptList.test month-total asserts toContain("3"); no TotalsHeader test, no list-level foreign/unconverted row test; ReceiptList + TotalsHeader each run own sums
- Task 4: minor (deferred): updateReceipt/createFolder calls in ReceiptDetail/FolderPicker lack error handling; compact-pushed /document/[id] stays full-screen after unfold; __DEV__ console.warn of error object
- Task 5: minor (deferred): any edit (even notes) recomputes FX and rebases homeCurrencyAtSave — offline w/o rate nulls a valid conversion (heals on next online reconvert); save writes folderId of a folder soft-deleted while form open; cancel Alert in hook vs discard Alert in screen (hook depends on i18n); edit mode shows OCR "Check this" hints; compact mounts 2 PageViewers (double decrypt); FolderPicker title "Move to folder" when opened from form; import grouping
- Task 6: minor (deferred): iOS DatePicker title duplicates shell label; wrapper View accessible may hide picker from VoiceOver (verify T11); Android Pressable lacks disabled state; no Android render test; stray blank line dateString.test.ts:1
- Task 6: minor (deferred): picking a non-today date from empty takes two taps
- Task 7: minor (deferred): unused key folders.save; CollectionScreen blank on unknown/deleted folder id and after back-with-no-history; tax-year route Number(year) NaN unguarded; FoldersScreen sumHome N+1 per version bump; no tests for unconverted totals / empty folder, weak /200/ regexes; emoji kind icon lacks accessibilityLabel; FolderForm duplicates FolderPicker creator UI
- Task 8: minor (deferred): renameCategory(null) on a custom category leaves it nameless (guard to defaults); delete-confirm count confirmed-only but drafts moved too; softDeleteCategory throw in Alert callback unhandled; row buttons share accessibilityLabel (name only in hint); swatch labels "Color N"; settings Row hardcoded "›"; categories.test lacks rollback/version/soft-deleted-not-moved checks; otherLabel fake Category cast
- Task 9: minor (deferred): custom preset w/o dates counts as active filter + chip but adds no bounds; deleted category id has no chip yet still filters (unremovable); today per render (stale past midnight); no tests for custom range UI or state across window-class change; 2 eslint-disable exhaustive-deps
- Task 10: minor (deferred): base-mismatch merge returns update unconditionally (stale old-home writer could overwrite new-base cache; next syncFx heals); prune-after-merge may drop another writer's old date (refetch only); syncFx race test asserts keys only; capture.tsx:104 overlong line
- Task 11: minor (deferred): seed purchasedAtUtc treats local clock as UTC; createFolder outside transaction (orphans), repeat taps duplicate; no busy guard on seed button; determinism test omits category/folder; real brand stems in merchants (needed for "indom" row); seed code in prod bundle via route (unreachable); APK link/status pending (build fd79f317 in progress)

## Controller rulings

- Ruling A1: T4 pushes `/edit/[id]` via `as unknown as Href` cast before T5 creates the route; T4 tests assert the push target only — cost if wrong: dead button between T4 and T5 commits.
- Ruling A2: T6 splits pure helpers into `src/components/dateString.ts` and the text fallback into `src/components/DateFieldText.tsx`; `DateField.tsx` (default/web) re-exports DateFieldText; `.ios/.android` use @expo/ui. Tests cover dateString + DateFieldText, plus one render test of `DateField` with `@expo/ui` jest.mocked — cost if wrong: two extra small files.
- Ruling A3: T11 runs ONE Android EAS dev build on personal account gia-terhubung (owner paid, M2 precedent) — cost: 1 build of quota.
- Ruling B1: plan text "refetch first page on version change" conflicts with Global Constraint (scroll position must survive) — on a data-version change (same filter) refetch keeps the loaded row count (limit = max(PAGE_SIZE, loaded)); only a filter change resets to page 1. Fix before review — cost if wrong: a slightly bigger query after each write.
- Ruling B2: document/[id] keeps the native header back; it does NOT pass onBack (ReceiptDetail's in-body back shows only when onBack is given, i.e. compact pane after fold) — one back control per screen — cost if wrong: none.
- Ruling B3: feed hides the FAB while compact && `selected` set (detail covering list) — cost if wrong: none.
- Ruling B4: FX line shows stored rate as "1 <receipt> = <rate> <home>", flipped to "1 <home> = <1/rate> <receipt>" below 0.1 — accepted (readable both ways) — cost if wrong: copy tweak.
- Ruling B5: keep `as unknown as Href` casts for /edit/[id] — typed routes come from gitignored .expo/types regenerated by Metro; removing breaks local tsc — cost if wrong: one cast per call site.
- Ruling B6 (⚠️ resolved): edit-mode Android back / iOS swipe-dismiss leave without "Discard changes?" — accepted for M3 (nothing written, plan requires the prompt on Cancel only); flagged to final review for triage — cost if wrong: accidental swipe loses typed edits.
- Ruling B7: accept jest globalSetup pinning TZ=Europe/Paris for all suites — per-file TZ had no effect; a fixed non-UTC DST zone makes date tests deterministic across hosts — cost if wrong: a host-zone-only bug could hide (tests no longer run in host zone).
- Ruling C1: ONE final fix wave = I1–I5 + the 3 fix-before-merge minors + B6 (edit-mode back/swipe "Discard changes?" via navigation beforeRemove/usePreventRemove — small, prevents silent loss of typed edits) + route-level __DEV__ guard on (dev)/db-check + fill APK/build row in docs/m3-acceptance.md if build fd79f317 finished — cost if wrong: slightly larger fix diff.
- Final: parked — m3-acceptance §1 says 570 tests (HEAD 582) — Ruling: doc staleness only, noted in m3-followups — cost: none
- Final: parked — B6 usePreventRemove proven only via mocks — Ruling: device rows R5/P5/F8 decide — cost if wrong: back/swipe still drops edits silently on device
- Final: parked — edit Save with no changes still writes + bumps version — Ruling: harmless, later — cost: needless sync churn later
