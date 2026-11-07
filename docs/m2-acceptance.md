# M2 acceptance: capture and parse

Date: 2026-11-07. Branch feat/m2-capture-parse. Status key: PASS / FAIL / OWNER-PENDING (needs a physical device) / BLOCKED (host problem, retry later).

## 1. Automated checks (run on host, apps/mobile)

| Check | Result | Status |
|---|---|---|
| `npx jest --maxWorkers=2` | Test Suites: 54 passed, 54 total. Tests: 408 passed, 408 total. Parser fixture report: total+date 45/50, total 48/50, date 46/50, merchant 44/45, category 46/46, currency 45/50 | PASS |
| `npx tsc --noEmit` | no output, exit 0 | PASS |
| `npm run check:pii` | ok: 68 dump tokens checked against fixtures, none found | PASS |
| Network audit `grep -rnE "fetch\(\|XMLHttpRequest\|WebSocket" src modules` | zero matches. Global `fetch` is referenced only as a default parameter in `src/fx/rates.ts` (lines 31, 74); `pipeline.ts` and `syncFx.ts` only pass `typeof fetch` types and an injected `fetchFn`. Only URL in app code: `https://cdn.jsdelivr.net/...` in `src/fx/rates.ts:24`. No axios | PASS |
| Android EAS development build | Build 66d47d31-e5cc-44a7-8189-268958e0c3b0, status finished on attempt 1 of 3. Kotlin of receipt-ocr and receipt-ai (Task 9 changes) compiled. APK: https://expo.dev/artifacts/eas/r1-qa_j8MBNKYvLPhxxgsF0iRuPYQ0m5Xknw9Lev8XM.apk (build page: https://expo.dev/accounts/gia-terhubung/projects/my-expenses-book/builds/66d47d31-e5cc-44a7-8189-268958e0c3b0) | PASS (compile). Runtime = OWNER-PENDING |
| Runtime network proxy session | Not possible on host | OWNER-PENDING (optional) |

## 2. iOS simulator end-to-end (iPhone 18 Pro Max, iOS 27)

Result: BLOCKED, cause UNKNOWN. After the simulator was rebooted, screenshots worked and the dev client bundled (Metro log: "iOS Bundled ... 1932 modules"). A dev-only `myexpensesbook:///capture?mode=photos&uris=...` link with a synthetic receipt opened the capture screen, but it stayed on "Reading receipt..." for over 2 minutes and the source file was never consumed. A relaunch showed only the splash. Two explanations are open: (a) the simulator was stalled (screenshots had hung earlier in the session), or (b) a real app hang in OCR or the capture pipeline. The frozen status-bar clock is NOT evidence (a healthy Task 1 screenshot also shows 09.14). This is not counted as a PASS and not as a confirmed app FAIL. It stays unresolved until the physical-device rows A8, A9, I3 (and a healthy simulator re-run) settle it: if capture reaches review on a device, it was the simulator; if it sticks on "Reading receipt..." there too, it is an app bug to fix before M2 sign-off. No evidence PNGs were added. Synthetic receipts for a re-run came from a Swift/AppKit script (CORNER MARKET USD 12.50; rotated copy; EUR cafe; two-label Indonesian shop), kept outside the repo.

Earlier simulator evidence from Tasks 1, 10, 11 (reports in `.superpowers/sdd/.../task-N-report.md`; `docs/m2-evidence/task1-*.png`) stays valid: cold-start lock route, dev-only capture link to review screen, view-cache purge on background.

| Row | Status | Note |
|---|---|---|
| Import screenshot, parsed review, save | BLOCKED on sim | Task 11 sim run reached review with parsed fields; save needs taps. Repeat on iPhone 12 Pro (section 4) |
| Rotated photo | BLOCKED on sim | Unit/OCR tests cover rotation (Ruling K); owner photo #21 case on device |
| Two-label photo, split prompt, 2 drafts | BLOCKED on sim | Needs taps for the prompt. Jest + fixture 24 vs 14 cover it |
| Re-import same photo, duplicate banner | BLOCKED on sim | Jest covers dHash and ref_no check |
| Foreign receipt typed manually, FX line | BLOCKED on sim | Task 11 sim showed the "≈ IDR 226,923.25" line for USD |
| Lock over review modal | OWNER-PENDING | Needs lock enabled (taps) |

## 3. Android: Redmi 14C owner checklist

Install: open the APK link above on the phone (or scan the build page QR), allow install from browser, open "My Expenses Book" (dev client). Start Metro on the Mac (`cd apps/mobile && npx expo start --dev-client`) and enter the URL shown, phone on same Wi-Fi. The APK is a development-client build (`developmentClient: true` in eas.json): it loads JavaScript from Metro, so JS-only changes (including the updated OCR check screen) are live without a new build. Finish onboarding first. Dev screens: Settings, Developer tools.

How the OCR check works (screen: Settings, Developer tools, OCR check): tap "Pick photos (up to 30)" and select all 24 WhatsApp photos in one go. The screen then shows a summary line and one row per photo, e.g. `#3: total 50000 IDR · date 2026-11-04 · 1200 ms · rot 0`. Amounts and dates only, no names or text. "Copy summary" shows the summary and rows as selectable text (long-press, Select All, Copy). Raw OCR text is behind a separate button with a privacy warning: never open it for the doc and never paste it anywhere. Row numbers follow the order you picked the photos. To tick correctness, compare each row against the paper receipt or the photo.

| # | Check | Pass criterion | Status |
|---|---|---|---|
| A1 | Install the APK, launch, onboarding completes | app opens, no crash | OWNER-PENDING |
| A2 | OCR check on the 24 photos (one batch). Compare each row's total and date with the receipt and tick which are correct | correct totals >= 23/24 and correct dates >= 21/24. Record counts only (totals correct __/24, dates correct __/24). Paste the summary line only, never receipt text | OWNER-PENDING |
| A3 | ms per photo from the summary line | median <= 2000 ms (the first photo includes model warm-up). Record median ____ and max ____ | OWNER-PENDING |
| A4 | Rotation: photo #21 (reading-direction rule, Ruling K) | its row shows a plausible total and date and `rot` 90/270; correct against the paper | OWNER-PENDING |
| A5 | Cross-platform hash (Task 4): the hash is shown only in the raw-text view, so use the duplicate check instead: import the SAME file on this phone and on the iPhone (I11) and see that each phone flags its own re-import as duplicate | no crash; re-import of one file shows the duplicate banner (A11) | OWNER-PENDING |
| A6 | Scan a paper receipt, multi-page (2 pages) | ML Kit scanner opens, both pages become ONE draft with 2 pages. Scanner URI shape works (a `content://` URI would make every scan fail: note any "failed" count) | OWNER-PENDING |
| A7 | Leftover scanner cache (`cache/mlkit_docscan_ui_client/`) | N/A: not checkable without root. Note it only if a crash occurs | N/A |
| A8 | Import from Photos (one real photo), then review, then Save | review opens with parsed merchant/date/total within 10 s and Save creates the receipt. FAIL if it stays on "Reading receipt..." longer than 10 s (note device and photo #). FAIL if OCR fails and no manual draft is created | OWNER-PENDING |
| A9 | Photo with no receipt (wall / handwritten) | draft with empty fields within 10 s, no crash, manual entry works. FAIL if stuck on "Reading receipt..." > 10 s (note photo #) | OWNER-PENDING |
| A10 | Two-label photo, then Split prompt | "Split into 2" gives 2 drafts; "Keep as one" gives 1. FAIL if stuck on "Reading receipt..." > 10 s | OWNER-PENDING |
| A11 | Re-import same photo | duplicate banner on review | OWNER-PENDING |
| A12 | Foreign currency receipt (type an EUR amount manually) | "≈ home currency" FX line appears online; saves offline with no FX (empty home amount) | OWNER-PENDING |
| A13 | Lock enabled, background app, return | lock screen shows; recents thumbnail is blank/hidden (FLAG_SECURE) | OWNER-PENDING |
| A14 | Lock while the review screen (modal) is open | lock screen covers the modal; after unlock review shows again | OWNER-PENDING |
| A15 | Lock while the picker/scanner is open and capture finishes | capture does not read or write while locked; continues after unlock | OWNER-PENDING |
| A16 | Rotate phone mid-review | form values kept, layout fine (fold n/a on Redmi) | OWNER-PENDING |
| A17 | Edit total, send app to background, return, Save | edited value kept and saved | OWNER-PENDING |
| A18 | Receipts tab banner "Continue reviewing (N)" | updates after closing the review modal (count drops after save/discard) | OWNER-PENDING |
| A19 | Permissions prompts (Ruling V) | photo picker needs no camera/mic prompt; scanner may ask camera; no microphone prompt ever | OWNER-PENDING |
| A20 | Airplane mode: capture, review, save | works fully offline | OWNER-PENDING |

Getting the same photo onto both phones for the hash/duplicate compare: pick one receipt photo, send it to yourself on WhatsApp as a DOCUMENT (paperclip, Document, not Gallery) so it is not recompressed, then save/download it on each phone and import that file on both.

## 4. iOS: iPhone 12 Pro owner steps and checklist

One-time setup (interactive, needs owner Apple account):
1. `cd apps/mobile && npx eas-cli device:create` and follow the QR/profile install on the iPhone.
2. `npx eas-cli build -p ios --profile development` (add the iPhone when asked), install from the build page link.
3. `npx expo start --dev-client`, open the app, enter the Metro URL. Enable Developer Mode on the phone if iOS asks.

| # | Check | Pass criterion | Status |
|---|---|---|---|
| I1 | Onboarding then Receipts tab | opens, no crash | OWNER-PENDING |
| I2 | Settings, Developer tools, OCR check: "Pick photos (up to 30)", select all 24 photos, compare each row's total and date with the receipt, tick which are correct | correct totals >= 23/24, correct dates >= 21/24. Record counts only and the median and max ms from the summary line. Never open or paste the raw OCR text | OWNER-PENDING |
| I3 | Import from Photos (use a screenshot), review, Save | review opens with parsed fields within 10 s and the receipt is saved. FAIL if it stays on "Reading receipt..." longer than 10 s (note device and photo #). A rejected source shows as a failed count: note it | OWNER-PENDING |
| I4 | Scan with the document camera, 2 pages | one draft containing both pages | OWNER-PENDING |
| I5a | Rotated photo (#21) | its OCR check row shows a plausible total and date and `rot` 90/270 | OWNER-PENDING |
| I5b | Two-label photo imported, then "Split into 2" | 2 drafts; "Keep as one" gives 1 | OWNER-PENDING |
| I5c | Import the same photo a second time | duplicate banner on the review screen | OWNER-PENDING |
| I6 | Foreign receipt: type a EUR amount manually in review | "≈ home currency" line shows online; saves offline with no home amount | OWNER-PENDING |
| I7 | Lock on, background and return; open the app switcher | switcher snapshot shows the cover, not receipt content | OWNER-PENDING |
| I8 | With lock on, lock while the review screen is open; also while the picker or scanner is open | lock screen covers the review; capture waits for unlock and continues after | OWNER-PENDING |
| I9 | Edit total, send app to background, return, Save | edited value kept and saved | OWNER-PENDING |
| I10 | Apple Intelligence | not available on iPhone 12 Pro: Settings, Developer tools, AI spike should report unavailable, and capture must still parse with heuristics | OWNER-PENDING |
| I11 | Cross-platform duplicate: put the same file on both phones (WhatsApp as DOCUMENT to yourself, then save on each), import it on the iPhone and the Redmi | each phone flags its own second import as duplicate; no crash | OWNER-PENDING |

iPad TwoPane (Task 11): no iPad owned. Stays BLOCKED/not tested; Jest covers the window-class switch.

## 5. Galaxy Z Flip 6: AI path (only device with Gemini Nano expected)

AI parsing ships OFF (`AI_PARSING_ENABLED = false` in `src/parsing/flags.ts`). Use the same Android APK (build above) for steps 1 to 3; step 4 needs a local build.

1. Install the APK and start Metro as in section 3.
2. Open the dev screen `ai-spike` (route `/ai-spike`, under Settings, Developer tools). Check `getAvailability`: expect "available" (or "downloadable": wait for model download on Wi-Fi, retry). Record the value: ____
3. Run one parse from the spike screen on a sample text. Record: result JSON valid yes/no, time in ms: ____. Note any code-fence output (validation should handle it).
4. To test inside the real capture flow: set `AI_PARSING_ENABLED = true` in `src/parsing/flags.ts`, run `npx expo start --dev-client` (JS-only change, no rebuild), import a photo, check the review screen shows AI-filled fields with sane confidence and that heuristics still win on conflicts per the merge rules. Revert the flag before committing.
5. Fold/unfold the phone in review and on the Receipts tab: no data loss, layout switches (Task 11 TwoPane/window class). Also lock over review as A14.

| # | Check | Status |
|---|---|---|
| Z1 | ai-spike availability value | OWNER-PENDING |
| Z2 | one successful parse from ai-spike | OWNER-PENDING |
| Z3 | flag-on capture flow works, no crash, fallback to heuristics on failure (restart Metro or press r to reload after editing flags.ts) | OWNER-PENDING |
| Z4 | fold/unfold mid-review | OWNER-PENDING |
| Z5 | all A-rows that apply (install, import, scan, lock) | OWNER-PENDING |

Go/defer decision for shipping AI: owner decides after Z1 to Z3.

## 6. Deferred device items traced to this acceptance

| Item | Source | Row |
|---|---|---|
| Lock over capture modal / real modal + background flow (Ruling E) | Task 1 | A13, A14, A15, I7, I8 |
| Android ML Kit boxes frame, reading-direction rule, cross-platform hash | Task 4 | A4, A5, I11 |
| Task 9 Kotlin compiles | Task 9 | Build above: PASS |
| Real picker/scanner URI prefixes, Android scanner output location, scanner URI shape, `mlkit_docscan_ui_client` sweep | Task 10 | A6, A7, A8, I3 |
| Permission prompts match Ruling V | Task 10 | A19 |
| edit, background, save; iPad TwoPane; banner refresh on modal close | Task 11 | A17, A18, I9, iPad not owned |
| Owner AI availability + one parse | Task 3 | Section 5 |
| Rotation heuristic on other layouts | Ruling K | A4, I5a |
| Fold/unfold continuity | Task 11 | Z4 |

## 7. Summary

Host checks PASS. Android dev build PASS (compile). iOS simulator end-to-end BLOCKED, cause UNKNOWN (simulator stall or real app hang in capture, see section 2); unresolved until A8/A9/I3 run on a device. Every row needs a physical device or a healthy simulator with tap tooling. All device rows OWNER-PENDING.
