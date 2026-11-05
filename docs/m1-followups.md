# M1 follow-ups (from the M0/M1 build ledger)

Carry these into M2+ planning. Generated from the subagent-driven build ledger on 2026-11-04.

## Rulings made during the build
- Ruling: Work on branch feat/m0-m1-foundation in place, no worktree — repo is brand new, single developer, path has spaces — cost if wrong: none material.
- Ruling R1: Android device/emulator steps deferred (no Android SDK/Java on host). Android verification = `npx expo prebuild -p android` + manifest/config inspection only, until owner installs Android Studio — cost if wrong: Android-only native bugs surface later; T3 Android LLM path unverified.
- Ruling R2: Execution order 1,4,3,5–14; T2 deferred until owner supplies photos. T3 uses 5 hand-written realistic receipt OCR texts (ID/EN/foreign) in `spikes/ocr-samples/` instead of T2 dumps — cost if wrong: AI spike accuracy measured on synthetic text.
- Ruling R5: MMKV encryption key — implementer checks installed react-native-mmkv's max key length/encoding and derives a key that fits using full-entropy encoding (truncate encoded string to limit); record in report — cost if wrong: prefs (non-sensitive) encrypted with ≥64-bit-entropy key.
- Ruling R1 update: owner won't install Android Studio. Android verification plan = EAS Simulator (cloud emulator, agent-driven) per task once owner runs `npx eas-cli login`; EAS development build on owner's phone at milestone ends. Until login: prebuild + config inspection only.
- Ruling: Task 8 detects wrong key via SQLite error code 26 / message includes 'file is not a database' (observed JS message: 'Error code 26: file is not a database') — not string equality — cost if wrong: misclassified open errors.
- Ruling: T3 spike 'defer to v1.1' rests on zero real inferences (simulator unsupported by FM safety guardrail). Treat AI decision as INCONCLUSIVE, not defer: keep module, verify on a physical Apple-Intelligence iPhone / Gemini Nano Android via EAS dev build before M2 parse work; owner decides go/defer then — cost if wrong: none (no work skipped).
- Ruling: M0 exit gate ('owner reviews before M1') — proceed into M1 without waiting; M1 (crypto/db/prefs/i18n/layout/lock/onboarding) depends on no OCR/AI decision, only on T4 (done). Owner reviews spike docs async; T2 runs when photos arrive — cost if wrong: none for M1 scope.
- Owner request: rename app 'My Receipt Book' → 'My Expenses Book'. Ruling: run as dedicated rename task right after T5 review (T5 agent running in this folder; renaming mid-run breaks it). Scope: folder name, app name, slug my-expenses-book, scheme myexpensesbook, bundle id com.terhubung.myexpensesbook, docs/spec/plan/master-plan filename+text, identifier prefix mrb→meb (mrb.db, mrb.masterKey.v1, mrb-<purpose>-v1, .mrb archive→.meb). Keep domain term 'receipt' (tables, receipt-ai module, receipt screens) — cost if wrong: extra rename later.
- Ruling: KAT (plan-mandated circular hkdfSync-vs-hkdfSync) replaced by hardcoded hex vectors for 'db' and 'prefs' — pins derivation across Node/quick-crypto; rename task will recompute literals — cost if wrong: none.
- Ruling: pull Minor 1 (category sort_order) + Minor 2 (line_items.receipt_id index) + Minor 5 (temp dir cleanup) into fix round — schema changes are free pre-release, a migration later; regenerate initial migration (nothing shipped) — cost if wrong: small extra scope.
- Ruling: RESET = erase ALL local app data (DB files + stored master key; prefs/images join in later tasks) then reopen fresh; SecretStore gains delete(); keys.ts gains resetMasterKey() — cost if wrong: reset semantics broader than "DB only" (intended: nothing is recoverable without the key anyway).
- Ruling: pull Minor "remove sidecar delete loop w/ bare catch" + "log closeSync failure in __DEV__" into fix (they cause Important #2) — cost: none.
- Task 11: implementer a13fd9ecafca26705. Ruling: Pixel Fold emulator check deferred (no Android SDK) — iPhone (compact) + iPad (rail) + iPad rotation on iOS sim instead; cost: Android fold/unfold continuity unverified until EAS.
- Ruling: tests must never live under src/app (Expo Router bundles them as routes → device crash); T11 test at src/layout/tabsLayout.test.tsx — carry to T12/T13. iPad rail/rotation device evidence deferred (iPad sim wedged; host headless) — Jest covers switch + route retention; cost: device-level fold/rotate unverified until EAS/owner device.
- Ruling: canEnableLock uses getEnrolledLevelAsync >= SECRET (spec: "device passcode counts") overriding brief's isEnrolledAsync — cost if wrong: none.
- Ruling: privacy cover separate from lock state (shown on background, resolved on active); timeout 0 locks immediately on background; native snapshot protection deferred to M5 polish — cost: brief OS snapshot exposure until then.
- Ruling: pull Minor 1 (fail-open on not_available only if enrolled level NONE) + Minor 3/4 (real LockGate tests) into fix — security-relevant.
- Ruling: T14 step 5 — keep (dev) spike routes with existing __DEV__ runtime guards (ai-spike needed for owner's physical-device AI test via EAS dev build); hard exclusion from release bundle deferred to M5 — cost: dead dev screens in release bundle, unreachable.
- Ruling: T14 network check — no proxy tool on host; verify by static audit (grep for fetch/XMLHttpRequest/WebSocket/axios in src + deps that phone home) + note; full proxy session deferred to owner device — cost: runtime-only network calls from native libs unverified.
- Ruling: Important #4 (lock below modals) deferred to M2 task 1 (reviewer allowed; no modal routes hold receipt data in M1) — cost: M1 pref sheets visible over lock.
- Ruling (accept reviewer challenge): native snapshot protection (FLAG_SECURE + iOS cover) moves from M5 to M2 task 1.
- Ruling (accept reviewer challenge): M2 capture/OCR/parse blocked until T2 OCR bake-off (owner photos) and T3 physical-device AI test are done.
- Ruling: locked-screen copy must not assert "wrong key" (NOTADB also = corruption/transfer).
- Ruling: final fix wave also includes T5 read-back-after-set (MasterKeyPersistError) and secure-random assertion — cheap, prevent key loss / weak IDs.
- Final: parked — assertSecureRandom at module scope bypasses ErrorBoundary (hard crash instead of themed error) — Ruling: stands for merge; it fails loudly and never falls back to Math.random (security goal met), condition only occurs if quick-crypto install breaks; move call into RootLayout render as M2 task-1 cleanup — cost if wrong: red screen instead of themed error in a should-never-happen case.

## Deferred minor findings
- Task 1: minor (deferred): jest-expo project has no .tsx test yet (first comes in T10)
- Task 1: minor (deferred): unused template deps (@expo/ui, expo-glass-effect, expo-device, expo-symbols, expo-image, react-native-web) — prune later
- Task 1: minor (deferred): eslint deps added beyond brief (harmless)
- Task 1: minor (deferred): template splash/icon branding placeholders
- Task 4: minor (deferred): (dev) spike routes bundled in release (runtime guard only) — T14 step 5 removes/guards them
- Task 4: minor (deferred): 560KB spike screenshot PNG in git
- Task 3: minor (deferred): Kotlin Generation.getClient() per call, never closed — M2 hold one client
- Task 3: minor (deferred): Kotlin parseReceipt checkStatus() throw not mapped to ERR_UNAVAILABLE
- Task 3: minor (deferred): web module name 'ReceiptAIModule' vs native 'ReceiptAI'
- Task 3: minor (deferred): ocr-samples/index.ts says GENERATED but no generator committed
- Task 3: minor (deferred): ai-spike auto-runs parses with no timeout
- Task 3: minor (deferred): Android free-text output may include code fences — M2 extract/validate; evaluate typed output API
- Task 5: minor (deferred): no read-back verification after store.set
- Task 5: minor (deferred): fromHex/toHex round-trip only tested at 32 bytes; uppercase hex rejected (unstated)
- Task 5: minor (deferred): uncleared Buffer copy of key in memory (JS limitation)
- Task 6: minor (deferred): VED missing from CURRENCIES
- Task 6: minor (deferred): formatMoney uses Intl default digits — IDR/HUF/COP etc. display 0 decimals (CLDR) though ISO exponent 2; decide display policy in M2/M3
- Task 6: minor (deferred): toMinor lowercase/space currency code not tested
- Task 7: minor (deferred): updated_at bump not asserted for folder rename / softDeleteReceipt; softDeleteFolder bumps child receipts' version (undocumented)
- Task 7: minor (deferred): parse_confidence could be text({mode:'json'}).$type<>()
- Task 7: minor (deferred): no status-transition validation in updateReceipt
- Task 7: minor (deferred): migrations.test temp dir rmSync not in finally
- Task 8: minor (deferred): wrong-key matcher tests for message-only / code-26-only paths
- Task 8: minor (deferred): raw handle not closed on unmount; failed/migration-error states have no retry; raw error messages shown
- Task 8: minor (deferred): DbErrorScreen imported from route file — move to src/components
- Task 8: Android device run outstanding (with T4) — EAS
- Task 8: minor (deferred): isNotFoundError matches message text (brittle)
- Task 9: minor (deferred): prefs/storage.ts deleteMMKV boolean ignored — failed wipe proceeds to key reset (use existsMMKV check + throw); no mocked test of real deletePrefsStorage
- Task 9: minor (deferred): initI18n re-calls .use(initReactI18next) on each call (hot reload only)
- Task 10: minor (deferred): TwoPane placeholder "—" lacks a11y handling
- Task 10: minor (deferred): TwoPane.test mocks internal RN path for useWindowDimensions (brittle)
- Task 10: minor (deferred): no ThemeProvider/useTheme light-dark test
- Task 10: minor (deferred): no maxFontSizeMultiplier guidance for title/headline
- Task 10: minor (deferred): caret vs exact dep pinning consistency
- Task 11: minor (deferred): window-class switch test asserts pathname only, not no-remount (add mount-counter probe)
- Task 11: minor (deferred): SideRail no insets.right for landscape cutouts
- Task 11: minor (deferred): __DEV__ settings links hardcoded English
- Task 12: minor (deferred): spurious "Authentication failed" when tapping during in-flight auto-prompt; Retry label after cancelled auto-prompt
- Task 12: minor (deferred): Android<=10 PIN fallback re-arms prompted; busy guard prevents double prompt; later failure leaves only Retry
- Task 12: device lock flows deferred (headless host) — verify on owner device at M1 acceptance/EAS
- Task 13: minor (deferred): CurrencyPicker getItemLayout fixed 48dp — breaks at large font scale; misplaced doc comment
- Task 13: minor (deferred): possible one-frame tabs flash before onboarding Redirect (hold splash)
- Task 13: minor (deferred): /onboarding with step done shows lock step (replace to /)
- Task 13: minor (deferred): stale local .expo/types can fail typecheck until typegen (local dev only)

## From OCR bake-off (2026-11-05) — carry into M2
- M2: add default category `default:transfer` (sort_order between office and other, e.g. 95; icon `arrow.left.arrow.right`) via new migration `0002` — never edit `0001`. Add `transfer` label to en/id/es/pt-BR locales. Owner ruling: transfers/top-ups/ATM withdrawals are expenses.
- M2: OCR module `recognizeText` must pin languages and auto-correct 90°/270° rotation (see `docs/spikes/2026-11-ocr-bakeoff.md`).
- M2: "Import from Photos / Share to app" is a first-class capture path (screenshots are most real inputs).
- M2: multi-receipt photo detection + "Split into 2 / Keep as one" (spec row "Multiple receipts in one photo"); fixture = spike photo 24 (must split) vs photo 14 (must not).
- M2: duplicate warning (spec row "Duplicate warning"): migration adds `receipts.ref_no` + `receipt_pages.dhash` (indexed); parser extracts ref numbers; check on save and on backup merge import.
