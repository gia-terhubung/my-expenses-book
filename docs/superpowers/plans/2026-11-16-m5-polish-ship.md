# M5 Polish & Ship Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make v1 shippable. That covers:
- a tip jar (expo-iap)
- the missing Settings pieces (About, Storage, Privacy policy, Tip jar, Error log)
- empty states with a next action
- an accessibility pass
- release hardening
- store metadata and a privacy policy page
- EAS production builds submitted to TestFlight and Play internal testing

**Architecture:**
- **Payments:** purchases sit behind `src/payments/` (`TipJar` interface + one expo-iap adapter). The store connection opens only while the Tip jar screen is mounted, so no other screen talks to a store. A later swap to RevenueCat touches only `src/payments/`.
- **Error log:** a capped ring buffer in the existing encrypted MMKV. The root `ErrorBoundary`, `ErrorPanel` and the backup post-commit catches feed it. The user views it in Settings and exports it through the existing `cache/export/` + share-sheet path.
- **Release hardening:** dev spike routes are required only under `__DEV__`, so Metro drops them from release bundles. The config gets the export-compliance flag and production/submit profiles.
- **Store work:** a static privacy page (`site/privacy/index.html`), EAS Metadata (`store.config.json`) for the App Store, and markdown sources for the Play listing and both privacy questionnaires.

**Tech Stack:**
- Expo SDK 58, RN 0.88, TS strict, Expo Router (routes in `src/app`), Jest (node + jest-expo projects).
- **One new dependency:** `expo-iap` (6.5.x, owner-approved in the spec: "v1 = `expo-iap` only"). Install it with `npx expo install expo-iap` and add its config plugin.
- Existing: `expo-constants` (version), `expo-web-browser` (privacy link), `expo-sharing` + `src/export/files.ts` (log export), `react-native-mmkv` (log store).

**Spec:** `docs/superpowers/specs/2026-11-04-my-expenses-book-design.md` (M5 row, "Monetization v1", "Payments", "Crash reporting", folder structure `settings.tsx` line, "Store prep", "Verification", Anti-goals). Carry-overs: `docs/m1-followups.md` (dev routes in release, unused template deps), `docs/m2-followups.md` T11, `docs/m3-followups.md` T6/T7/T8 a11y minors, `docs/m4-followups.md` (owner device checks).

**Calls made by the plan author (owner may override at review):**
- **C1: store connection is scoped to the Tip jar screen.** `initConnection` runs on mount and `endConnection` on unmount. Cold start makes no store call. This keeps the network rule tight: store traffic happens only when the user opens Tip jar.
- **C2: error log contents.** At most 200 entries, newest first. Each entry is `{ at, scope, message (≤500 chars), stack (first 8 lines) }`. The app adds no receipt data on purpose. The log is shared only when the user taps Export. Clear deletes it.
- **C3: languages for the policy and listing.** The privacy policy and store listing are written in EN and ID. ES and PT-BR listing text waits for v1.1, following the spec's slip policy: ES/PT-BR are the first cut. The app UI keeps all 4 locales.
- **C4: hosting is the owner's job.** The plan ships `site/privacy/index.html` and a `PRIVACY_POLICY_URL` constant. The owner publishes the page (e.g. GitHub Pages from a separate repo or branch) and fills in the URL before the submit task. Publishing `docs/` would expose plans and follow-ups, so do not publish it.
- **C5: no Maestro in M5.** The M3 run found the host has no tap tooling. The spec's E2E flow becomes a manual row in `docs/m5-acceptance.md`.
- **C6: versioning.** Keep `appVersionSource: "remote"`. The `production` profile uses `autoIncrement: true`. The marketing version stays `1.0.0`.
- **C7: owner gate (owner decision, 2026-11-16).** The EAS dev build and every OWNER-PENDING row in `docs/m4-acceptance.md` must pass before Task 9 starts any store build. M5 code tasks may run before that.

## Global Constraints

**Testing and tooling**
- Tests never live under `src/app/`. Route files stay thin.
- All commands run in `apps/mobile`. Gates at every commit: `npx jest`, `npx tsc --noEmit`, `npm run check:pii`, `npx expo lint`.
- Git identity is the repo-local Gia <terhubungapp@gmail.com>. Never commit, read or quote `apps/mobile/spikes/receipts/` or `spikes/ocr-dumps/`. All test data is synthetic.
- Work on branch `feat/m5-polish-ship` from `main` (7d759aa).
- `expo-iap` is the only new dependency. Prune unused ones only as described in Task 7.

**Network and privacy (spec anti-goals)**
- Allowed outbound calls: the FX host and store IAP. Nothing else, including no analytics and no crash SDK.
- The privacy link opens through `expo-web-browser` only when the user taps it.
- Do not persist purchase data. Sales history lives in the store consoles.

**Payments (spec)**
- Product IDs: `tip_coffee_small` ($2.99), `tip_coffee_standard` ($4.99), `tip_coffee_generous` ($9.99). All three are consumables.
- Show prices from the store's localized `displayPrice`. Never hardcode a price.
- Every successful purchase ends with `finishTransaction({ purchase, isConsumable: true })`. Without it, Android refunds the purchase after 3 days and iOS replays it.
- All expo-iap imports go in `src/payments/expoIap.ts`. Other files use the `TipJar` interface only.

**UI rules (carried from M4)**
- Every RN `Modal` is an `AppModal`. Touch targets are ≥48. Colors, spacing and type come from `useTheme()`. New screens are centered with `maxWidth: 560`.
- Every new string goes into all 4 locale files with identical key sets (`locales.test.ts`). New namespaces are `tips`, `about` and `errorLog`. en is authored; id/es/pt-BR are careful translations.
- Before any expo-iap / expo-web-browser / expo-constants code, read the SDK 58 docs (`AGENTS.md`). For expo-iap, read the installed `node_modules/expo-iap/build/index.d.ts`.

## Review Focus

1. **The user cancels the purchase sheet.** The screen returns to idle with no error alert and calls no `finishTransaction`. Test in Task 1.
2. **Store unreachable or no products returned.** This covers airplane mode, a Play build not installed from Play, and the IAP products not yet approved. The screen shows "Tips aren't available right now" and Retry, with no spinner forever. Test in Task 2.
3. **A purchase arrives after the screen unmounted, or a pending purchase is replayed on the next open.** The listener on the next mount must still finish the purchase as a consumable and thank the user once. Test in Task 1.
4. **The error log fills up or holds a huge error** (a 1 MB message, a deep stack). The cap and truncation hold, and the log screen still renders. Test in Task 3.
5. **The release bundle still contains dev spike code**, such as the `spike.db` key literal or the OCR check screen. Verify with an exported production bundle in Task 7.

---

### Task 1: Payments layer (`src/payments/`)

**Files:**
- Create: `src/payments/types.ts`, `src/payments/tipFlow.ts`, `src/payments/expoIap.ts`, `src/payments/fakeTipJar.ts`
- Modify: `package.json` (expo-iap), `app.config.ts` (expo-iap plugin, if the installed package ships one; read its README)
- Test: `src/payments/tipFlow.test.ts`

**Interfaces:**
- Produces:
  - `type TipId = "tip_coffee_small" | "tip_coffee_standard" | "tip_coffee_generous"`, `TIP_IDS: readonly TipId[]` (in that display order)
  - `type TipProduct = { id: TipId; displayPrice: string; title: string }`
  - `type TipEvent = { kind: "thanks"; id: TipId } | { kind: "cancelled" } | { kind: "failed"; code: string }`
  - `interface TipJar { connect(): Promise<void>; products(): Promise<TipProduct[]>; buy(id: TipId): Promise<void>; onEvent(cb: (e: TipEvent) => void): () => void; disconnect(): Promise<void> }`
  - `createExpoIapTipJar(): TipJar` (expoIap.ts)
  - `createFakeTipJar(opts?: { products?: TipProduct[]; failConnect?: boolean }): TipJar & { emit(e: TipEvent): void; bought: TipId[] }`
  - `handlePurchase(p: { productId: string }, finish: (consumable: true) => Promise<void>): Promise<TipEvent | null>` (tipFlow.ts). It is pure and shared by the adapter. It returns `null` for unknown product IDs and finishes those too, so they do not replay.
  - `mapPurchaseError(e: { code?: string }): TipEvent`. expo-iap's user-cancelled code becomes `{ kind: "cancelled" }`. Look up the exact `ErrorCode` member in the installed `.d.ts`.

- [ ] **Step 1: Branch and install.** Run `git switch -c feat/m5-polish-ship`, then `npx expo install expo-iap`. Add its plugin to `app.config.ts` `plugins` only if the package documents one.
- [ ] **Step 2: Write failing tests** in `tipFlow.test.ts`:
  - `handlePurchase` for `tip_coffee_standard` calls `finish(true)` once and returns `{ kind: "thanks", id: "tip_coffee_standard" }`.
  - For `"unknown_sku"` it calls `finish(true)` and returns `null`.
  - If `finish` rejects, the call rejects and does not return thanks.
  - `mapPurchaseError` with the cancel code returns `{ kind: "cancelled" }`. With `"E_NETWORK"` it returns `{ kind: "failed", code: "E_NETWORK" }`. With `{}` it returns `{ kind: "failed", code: "unknown" }`.
  - `TIP_IDS` deep-equals the three spec IDs in order.
- [ ] **Step 3: Run** `npx jest src/payments`. Expected: FAIL (module missing).
- [ ] **Step 4: Implement** `types.ts`, `tipFlow.ts` and `fakeTipJar.ts`. Then implement `expoIap.ts`:
  - `connect` calls `initConnection`.
  - `products` calls `fetchProducts({ skus: TIP_IDS, type: "in-app" })` and maps the result to `TipProduct`, dropping unknown IDs.
  - `buy` calls `requestPurchase` with the per-platform request shape from the `.d.ts`.
  - `onEvent` wires `purchaseUpdatedListener` to `handlePurchase` (finish through `finishTransaction({ purchase, isConsumable: true })`) and `purchaseErrorListener` to `mapPurchaseError`. It returns a function that removes both listeners.
  - `disconnect` calls `endConnection`.
  - No module-level side effects, so importing the file does not touch the store.
- [ ] **Step 5: Run** `npx jest src/payments && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit** with `feat(payments): tip jar interface and expo-iap adapter`.

### Task 2: Tip jar screen

**Files:**
- Create: `src/tips/TipJarScreen.tsx`, `src/tips/useTipJar.ts`, `src/app/tip-jar.tsx` (thin: `<TipJarScreen jar={createExpoIapTipJar()} />` memoized once)
- Modify: `src/i18n/locales/{en,id,es,pt-BR}.json` (`tips.*`)
- Test: `src/tips/TipJarScreen.test.tsx`

**Interfaces:**
- Consumes: `TipJar`, `TipEvent`, `TIP_IDS`, `createFakeTipJar` (Task 1)
- Produces:
  - `useTipJar(jar: TipJar): { state: "loading" | "ready" | "unavailable" | "buying"; products: TipProduct[]; thanked: TipId | null; buy(id: TipId): void; retry(): void }`
  - Route `/tip-jar`

`en` copy (exact):
- `tips.title` "Tip jar"
- `tips.intro` "My Expenses Book is free, with no ads and no tracking. If it saves you time, you can buy the developer a coffee."
- `tips.small` "Small coffee"
- `tips.standard` "Coffee"
- `tips.generous` "Generous coffee"
- `tips.thanks` "Thank you! Your tip keeps this app independent."
- `tips.unavailable` "Tips aren't available right now. Check your connection and try again."
- `tips.failed` "The purchase didn't go through. You weren't charged."
- `tips.retry` "Try again"

- [ ] **Step 1: Write failing tests** with `createFakeTipJar`:
  - Mount calls `connect`, then shows 3 buttons labelled `"<tier> , <displayPrice>"` in `TIP_IDS` order. Unmount calls `disconnect`.
  - `failConnect: true` shows `tips.unavailable` and Retry. Retry calls `connect` again.
  - An empty `products` result also shows unavailable. This is Review Focus 2.
  - Tapping Coffee calls `buy("tip_coffee_standard")` and disables all buttons while state is `buying`.
  - Emitting `cancelled` returns to `ready` with no alert. This is Review Focus 1.
  - Emitting `failed` shows `tips.failed` inline.
  - Emitting `thanks` shows `tips.thanks`. Emitting `thanks` before any `buy` (a replayed purchase) also shows thanks once. This is Review Focus 3.
- [ ] **Step 2: Run** `npx jest src/tips`. Expected: FAIL.
- [ ] **Step 3: Implement** `useTipJar` and `TipJarScreen`:
  - Subscribe with `jar.onEvent` before `connect`, so replayed purchases are not missed.
  - Clean up on unmount.
  - Use `accessibilityState={{ disabled }}` on buttons and `accessibilityLiveRegion="polite"` on the status text.
  - Add the strings to all 4 locales.
- [ ] **Step 4: Run** `npx jest src/tips src/i18n && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(tips): tip jar screen`.

### Task 3: Local error log

**Files:**
- Create: `src/errorLog/errorLog.ts`, `src/errorLog/instance.ts`, `src/errorLog/ErrorLogScreen.tsx`, `src/app/error-log.tsx`
- Modify:
  - `src/app/_layout.tsx` (`ErrorBoundary` logs `scope: "render"`)
  - `src/components/ErrorPanel.tsx` (new optional `scope` prop; logs once on mount when `details` is set)
  - `src/backup/importBackup.ts` (post-commit catches log `scope: "backup.postCommit"` in all builds, not only `__DEV__`)
  - locales (`errorLog.*`)
- Test: `src/errorLog/errorLog.test.ts`, `src/errorLog/ErrorLogScreen.test.tsx`

**Interfaces:**
- Consumes: `KV` (`src/prefs/prefs.ts`), the encrypted MMKV KV used by `src/prefs/storage.ts`, `shareFile` / `EXPORT_DIR` / `purgeExportDir` (`src/export/files.ts`)
- Produces:
  - `type ErrorEntry = { at: number; scope: string; message: string; stack?: string }`
  - `createErrorLog(kv: KV, now?: () => number): { append(scope: string, e: unknown): void; list(): ErrorEntry[]; clear(): void; toText(appVersion: string): string }`
  - `errorLog` (instance.ts singleton) and `logError(scope: string, e: unknown): void`. `logError` never throws, even when storage fails.
  - Storage key `"errorLog.v1"`, constants `MAX_ENTRIES = 200`, `MAX_MESSAGE = 500`, `MAX_STACK_LINES = 8`

`en` copy:
- `errorLog.title` "Error log"
- `errorLog.intro` "Errors the app ran into. Nothing leaves your phone unless you export it."
- `errorLog.empty` "No errors recorded."
- `errorLog.export` "Export"
- `errorLog.clear` "Clear log"
- `errorLog.clearConfirm` "Delete all recorded errors? This can't be undone."

- [ ] **Step 1: Write failing tests** in `errorLog.test.ts`:
  - Append order is newest first.
  - 201 appends leave 200 entries, and the oldest is dropped.
  - A 1 MB message is stored as 500 chars. This is Review Focus 4.
  - A 50-line stack keeps 8 lines.
  - Non-Error values are stored by `String(e)`: `"boom"`, `{}`, `null`.
  - Corrupt JSON under the key reads as `[]` and the next append still works.
  - A KV whose `set` throws: `append` does not throw.
  - `toText("1.0.0")` starts with `My Expenses Book 1.0.0` and contains one ISO-timestamped block per entry.
- [ ] **Step 2: Run** `npx jest src/errorLog/errorLog`. Expected: FAIL.
- [ ] **Step 3: Implement** `errorLog.ts` and `instance.ts`.
- [ ] **Step 4: Write failing screen tests**:
  - It lists entries.
  - It shows the empty copy when there are none.
  - Export writes `errors-<YYYY-MM-DD>.txt` under `EXPORT_DIR` and calls `shareFile`. Mock `@/export/files`.
  - Clear asks through `Alert` with a destructive button and empties the list on confirm.
  - With 200 entries, each holding an 8-line stack, the screen renders without throwing. Use `FlatList`.
- [ ] **Step 5: Implement** the screen and route. Wire the three log sites. Add the locale strings.
- [ ] **Step 6: Run** `npx jest && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 7: Commit** with `feat(errorlog): local error log with export`.

### Task 4: Settings completion (About, Storage, Privacy, Tip jar, Error log)

**Files:**
- Create: `src/about/links.ts`, `src/about/storageStats.ts`
- Modify: `src/app/(tabs)/settings.tsx`, locales (`about.*`, `settings.tipJar`, `settings.storage`, `settings.errorLog`)
- Test: `src/about/storageStats.test.ts`, extend `src/components/settingsExportRows.test.tsx`

**Interfaces:**
- Consumes: `/tip-jar` (Task 2), `/error-log` (Task 3)
- Produces:
  - `PRIVACY_POLICY_URL: string` (placeholder `"https://example.invalid/privacy"` until the owner fills it in; Task 8 checks for it)
  - `storageStats(db, fs): Promise<{ receipts: number; pages: number; bytes: number }>`. It counts confirmed, non-deleted receipts, the pages of those receipts, and the summed size of their image and thumb files. A missing file counts 0 bytes.
  - `formatBytes(n: number, locale: string): string` uses `Intl.NumberFormat` with unit `kilobyte`/`megabyte`/`gigabyte` and base 1000.

- [ ] **Step 1: Write failing tests**:
  - `storageStats` on `testDb` with 2 confirmed receipts (3 pages), 1 draft and 1 soft-deleted receipt, using a fake `fs` that gives sizes and one missing file, returns `{ receipts: 2, pages: 3, bytes: <sum> }`.
  - `formatBytes(1_500_000, "en")` returns `"1.5 MB"`. `formatBytes(0, "en")` returns `"0 kB"`.
  - The settings test finds rows Tip jar, Storage, Privacy policy, Error log and Version. Tapping Tip jar pushes `/tip-jar`. Tapping Privacy policy calls the mocked `WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)`.
  - The Row chevron is `accessibilityElementsHidden` / `importantForAccessibility="no"`, which fixes the hardcoded "›" from the M3 T8 minor.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Storage row value: `"<n> receipts · <bytes>"`, loaded on focus.
  - Version row: `Constants.expoConfig?.version`. `expo-application` is not installed, so show no build number and do not add the dependency.
  - Rows go into two titled groups: "Support" (Tip jar, Error log) and "About" (Privacy policy, Version).
- [ ] **Step 4: Run** `npx jest && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(settings): about, storage, tip jar and error log rows`.

### Task 5: Empty states with a next action

**Files:**
- Modify:
  - `src/app/(tabs)/index.tsx` (feed empty: Scan and Add manually buttons that call the existing `start("scan")` / `start("manual")`)
  - `src/organize/FoldersScreen.tsx` (empty: "New folder" button that opens the existing `FolderForm`)
  - `src/organize/CollectionScreen.tsx` (unknown or deleted folder id, or a NaN tax year: `EmptyState` titled `folders.notFound` with a Back button that calls `router.back()`, or `router.replace("/folders")` when `!router.canGoBack()`. This fixes the M3 T7 minor.)
  - `src/layout/TwoPane.tsx` (the "—" placeholder becomes `EmptyState` with `empty.document`, fixing the M1 T10 minor)
  - locales (`empty.scanFirst`, `empty.addManually`, `folders.notFound`; reuse the existing `folders.new` "New folder…")
- Test: extend `src/organize/CollectionScreen.test.tsx`, `src/organize/FoldersScreen.test.tsx`, `src/layout/TwoPane.test.tsx`, and a new `src/receipts/feedEmpty.test.tsx`

`en` copy: `empty.scanFirst` "Scan a receipt", `empty.addManually` "Add manually", `folders.notFound` "This folder no longer exists."

- [ ] **Step 1: Write failing tests**:
  - Feed with zero receipts: tapping "Scan a receipt" invokes the scan path. The test mocks `scanPages` and asserts it was called.
  - Folders with zero folders: "New folder" opens the form.
  - `CollectionScreen` with a missing folder id renders `folders.notFound` and Back. With no history, Back calls `router.replace("/folders")`.
  - Tax year `"abc"` also renders not-found.
  - The `TwoPane` placeholder renders `empty.document` text.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** Extract the feed's `start` so the empty state and the FAB share it. Do not duplicate it.
- [ ] **Step 4: Run** `npx jest && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(ui): empty states with next actions`.

### Task 6: Accessibility pass

**Files:**
- Create: `src/theme/contrast.test.ts`, `src/components/pressableGuard.test.ts` (static source scan, same style as `appModalGuard.test.ts`)
- Modify: every file the guard flags, plus these:
  - `src/review/ReviewFields.tsx` (field errors and "Check this" go into the field's `accessibilityHint`, and a save attempt with errors calls `AccessibilityInfo.announceForAccessibility(<first error>)`; M2 T11 minor)
  - `src/organize/CategoryForm.tsx` (swatch labels use color names from a `categoryColors.ts` name key instead of "Color N"; M3 T8)
  - `src/organize/FoldersScreen.tsx` (the emoji kind icon is hidden from accessibility and the row label includes the translated kind; M3 T7)
  - locales (swatch color names, if new)
- Test: the two new tests, plus the `ReviewFields` and `CategoryForm` assertions in their existing test files

- [ ] **Step 1: Write the failing contrast test.** For `lightColors` and `darkColors`, compute the WCAG 2.1 contrast ratio (relative luminance formula) and assert:
  - `text` on `background` and on `surface` ≥ 4.5
  - `textMuted` on `background` and on `surface` ≥ 4.5
  - `onPrimary` on `primary` ≥ 4.5
  - `danger` and `warning` on `surface` ≥ 4.5
  - `primary` on `surface` ≥ 3 (large text / UI)
- [ ] **Step 2: Write the failing guard test.** Read every non-test `src/**/*.tsx`. For each `<Pressable` opening tag (up to its matching `>` at depth 0), assert it contains `accessibilityRole` or appears in an explicit allowlist with a reason comment. The test prints file:line for each offender.
- [ ] **Step 3: Run** both. Expected: the contrast test may pass or fail. Record which pairs fail. The guard test fails with the list of offenders.
- [ ] **Step 4: Fix.**
  - Adjust only failing token values, the smallest change that clears the ratio. Keep the hue.
  - Add `accessibilityRole` (and `accessibilityLabel` where the child is not text) to each offender.
  - Apply the three listed minors with tests:
    - `ReviewFields`: an error field's hint contains the error text, and a save attempt calls the mocked `announceForAccessibility`.
    - `CategoryForm`: swatch labels are color names.
    - `FoldersScreen`: the row label contains the kind word, and the emoji has `accessibilityElementsHidden`.
- [ ] **Step 5: Run** `npx jest && npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 6: Commit** with `fix(a11y): contrast, roles and announced review errors`.

### Task 7: Release hardening

**Files:**
- Create: `src/dev/screens/{AiSpike,DbCheck,DbSpike,OcrCheck}.tsx` (moved bodies)
- Modify: `src/app/(dev)/*.tsx`, `app.config.ts`, `package.json`
- Test: `src/dev/devRoutes.test.ts`

**Interfaces:**
- Produces: each `src/app/(dev)/<name>.tsx` becomes exactly this pattern, so Metro's production constant folding removes the `require`:

```tsx
import { Redirect } from "expo-router";
// Metro folds __DEV__ to false in release, so the screen module is never bundled.
const Screen: React.ComponentType = __DEV__ ? require("@/dev/screens/DbSpike").default : () => <Redirect href="/" />;
export default Screen;
```

- [ ] **Step 1: Write the failing test.** For each of the four route files, the source text matches `/__DEV__ \? require\("@\/dev\/screens\//` and has no other `@/` imports. This is a static read.
- [ ] **Step 2: Move the screen bodies** into `src/dev/screens/`, keeping their internal `__DEV__` guards. Rewrite the routes in the pattern above.
- [ ] **Step 3: Update `app.config.ts`.** Set `ios.config.usesNonExemptEncryption = false`. The spec says to declare the app exempt, since it uses standard OS/AES encryption.
- [ ] **Step 4: Prune unused template deps** (M1 T1 minor). For each of `@expo/ui`, `expo-glass-effect`, `expo-device`, `expo-symbols`, `expo-image`, `react-native-web`, run `grep -rn "<pkg>" src modules app.config.ts`. Remove a package only with zero hits. Check `react-native-web` against `web.output` in `app.config.ts` first: if web is unused, remove the `web` block together with it. Run `npx expo-doctor`. Expected: no new failures compared with before the change. Paste both outputs into the commit body.
- [ ] **Step 5: Verify the bundle** (Review Focus 5). Run `npx expo export --platform android --output-dir /tmp/m5-bundle`, then `grep -rl "0123456789abcdef0123456789abcdef" /tmp/m5-bundle`. Expected: no match. The dev spike key literal is gone. Then delete `/tmp/m5-bundle`.
- [ ] **Step 6: Run** `npx jest && npx tsc --noEmit && npx expo lint`. Expected: PASS.
- [ ] **Step 7: Commit** with `chore(release): strip dev routes from release, export compliance, prune deps`.

### Task 8: Privacy policy page, store metadata, EAS profiles

**Files:**
- Create (repo root):
  - `site/privacy/index.html`: EN + ID sections, a self-contained static page with inline CSS, no scripts and no external resources
  - `docs/store/play-listing.md`
  - `docs/store/privacy-answers.md` (Apple App Privacy + Play Data Safety answers)
  - `docs/store/assets.md` (required screenshot and graphic sizes plus the capture procedure)
- Create: `apps/mobile/store.config.json` (EAS Metadata, App Store, `en-US` and `id`)
- Modify: `apps/mobile/eas.json`

**Content decided here (exact facts; prose is the implementer's):**
- Policy facts:
  - Data stays on the device, encrypted.
  - No account, analytics, ads or crash reporting.
  - Outbound calls: (1) FX rate tables from `cdn.jsdelivr.net` (`@fawazahmed0/currency-api`, see `src/fx/rates.ts`), sending only currency codes and a date; (2) App Store / Google Play when the user opens Tip jar.
  - Purchases are handled by Apple/Google; the app stores no payment data.
  - Backups are files the user creates and stores wherever they choose. A passphrase-protected backup is encrypted. The developer never receives them.
  - Deleting the app deletes all data.
  - Contact: the owner fills in `CONTACT_EMAIL`. Leave the literal placeholder; Task 9 checks for it.
- Apple App Privacy: **Data Not Collected**. Export compliance: exempt (`usesNonExemptEncryption: false`).
- Play Data Safety:
  - No data collected or shared.
  - Data is encrypted in transit: yes (HTTPS for FX).
  - The user can request deletion: data is local, so uninstalling deletes it.
- Categories: App Store `FINANCE` (secondary `PRODUCTIVITY`). Play: Finance.
- `eas.json` adds:
  - `preview`: internal distribution, Android `apk`
  - `production`: `autoIncrement: true`, Android `app-bundle`
  - `submit.production.ios.ascAppId`: owner placeholder `"ASC_APP_ID"`
  - `submit.production.android.track`: `"internal"`
  - `submit.production.android.serviceAccountKeyPath`: `"./secrets/play-service-account.json"`. Add `apps/mobile/secrets/` to `.gitignore` in the same commit.
- `docs/store/assets.md` sizes:
  - iPhone 6.9" 1320×2868
  - iPad 13" 2064×2752 (required, since `supportsTablet: true`)
  - Play phone screenshots (min 2, 1080×1920 or larger)
  - Play feature graphic 1024×500
  - Play icon 512×512 (from `assets/images/icon.png`)
  - Capture procedure: a dev build, `src/dev/seed.ts` synthetic data, and device screenshots of feed, review, folders, export, and the unfolded two-pane view

- [ ] **Step 1: Write the four docs, the HTML page and `store.config.json`.** Check `store.config.json` with `npx eas-cli@latest metadata:lint` if the CLI offers it; otherwise validate the JSON with `node -e`.
- [ ] **Step 2: Check the page.** Run `grep -nE "https?://|<script|<link" site/privacy/index.html`. Expected: only the FX host text inside policy prose and the mailto placeholder. No script or link tags.
- [ ] **Step 3: Check the profiles.** Run `npx eas-cli@latest config --profile production --platform android`. Expected: it prints a resolved config with no error. This makes no build and spends no quota.
- [ ] **Step 4: Commit** with `docs(store): privacy policy page, listing, privacy answers, EAS profiles`.

### Task 9: Acceptance doc, owner gate, builds and submit

**Files:**
- Create: `docs/m5-acceptance.md`, `docs/m5-followups.md`

- [ ] **Step 1: Write `docs/m5-acceptance.md`** in the M4 format (PASS / FAIL / OWNER-PENDING / PENDING). Rows:
  - **Gate G1:** the EAS dev build and all M4 OWNER-PENDING rows are PASS (owner decision 2026-11-16).
  - Tip jar:
    - iOS sandbox purchase of each tier on the iPhone 12 Pro. Thanks shows, and the purchase does not replay on the next open.
    - Play license-tester purchase on the Redmi 14C, needs an internal-track install.
    - Cancel returns to idle.
    - Airplane mode shows unavailable.
  - Proxy session (Proxyman/Charles), a full flow including Tip jar. Only the FX host and store endpoints appear.
  - VoiceOver (iPhone) and TalkBack (Redmi) walkthroughs of feed → review → save → search → export.
  - Font scale at the largest size on both devices: no clipped totals or buttons.
  - Z Flip 6 fold/unfold on the feed and the Tip jar.
  - Manual E2E: onboarding → scan → review → save → search finds it → export CSV (C5).
  - Placeholders replaced: `PRIVACY_POLICY_URL`, `CONTACT_EMAIL`, `ASC_APP_ID`. Check with `grep -rn "example.invalid\|CONTACT_EMAIL\|ASC_APP_ID" apps/mobile/src apps/mobile/eas.json site`, which must return nothing.
  - Store-console setup is the owner's job: create the 3 consumables with the spec prices, enroll in the Apple Small Business Program / Play 15% tier, complete the questionnaires from `docs/store/privacy-answers.md`, upload the assets.
- [ ] **Step 2: Run** `npx jest && npx tsc --noEmit && npm run check:pii && npx expo lint`. Record the results in the doc's build-status table.
- [ ] **Step 3: Commit** with `docs(m5): acceptance checklist`.
- [ ] **Step 4: STOP for the owner.** Do not run any `eas build` or `eas submit` until G1 and the placeholder row are PASS and the owner says go. Builds spend quota and submits are outward-facing.
- [ ] **Step 5 (after owner go): build.** Run `npx eas-cli@latest build --profile production --platform all`. Expected: both builds finish. Record the build IDs in the acceptance doc.
- [ ] **Step 6 (after owner go): submit.** Run `npx eas-cli@latest submit --profile production --platform ios --latest` and `npx eas-cli@latest submit --profile production --platform android --latest`. Expected: TestFlight processing, and the Play internal track has a new release. Record both in the acceptance doc.
- [ ] **Step 7: Commit** with `docs(m5): build and submit status`. Write `docs/m5-followups.md` with controller rulings and deferred minors in the M4 format.
