# Native Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the owner-approved `spike/duo-native-nav` branch into shippable code on `main`: green tests,
the last screens on the approved patterns, no spike leftovers, e2e coverage for the iPhone Duo.

**Architecture:** The spike's code is the approved design (spec "Final decisions"), so this plan hardens
it in place on the spike branch rather than rewriting it: fix the test harness for the new native
`Stack`/`NativeTabs` structure, move the remaining old-style screens onto the native header and sheet
patterns, close the spec's open items, remove spike-only names and comments, add e2e flows, then merge.

**Tech Stack:** Expo SDK 58, expo-router 58.0.32 (`NativeTabs`, `Stack.Toolbar`), `expo-status-bar`
(`useVerticalBarEdgeIOS`), `@expo/ui` Menu, Jest (`jest-expo`), AXe + `xcrun simctl` and `adb` e2e scripts.

**Spec:** `docs/superpowers/specs/2026-11-26-duo-native-navigation-design.md` (approved 2026-11-27).
Read its "Final decisions" section first; it overrides the older sections.

## Global Constraints

- Work on branch `spike/duo-native-nav` in `apps/mobile`; merge to `main` only in Task 9.
- iOS: `NativeTabs` with `preferredPlacement="tabBar"`; 4 tabs (Receipts, Search, Folders, Settings).
- Android: JS tabs stay; bottom bar on phones, `SideRail` (tabs at the bottom, above the +) on wider windows.
- The + is variant B: last header item in the Duo column; floating bottom-right with no column; Home
  floats it when held upright; short column (window height < 560 pt, `SHORT_COLUMN_HEIGHT`) folds page
  extras into ⋯ with an "Add receipt ›" row at the top of ⋯.
- iOS + opens Apple's menu: Scan receipt / Import from Photos / Add manually (icon + word). Empty Home and
  Android keep the add sheet.
- No + on Search, sheets, the photo viewer, or create/edit pages.
- Sheets and create/edit pages: icon X (cancel) and green ✓ (done) in the bottom toolbar; text buttons
  stay in a sheet's top bar; destructive actions as a trash icon at the top.
- Words on every action (older users); touch targets ≥ 44 pt / 48 dp.
- Never by device model: decide by window size and `useVerticalBarEdgeIOS()` only.
- Every user-visible string goes through i18n in all 4 app languages.

## Review Focus

1. **Fold, unfold or rotate with a sheet or the + menu open**: the sheet stays and typed values survive
   (Task 8, `e2e/duo-nav.sh` step D).
2. **Large text in a short Duo column** (466 pt high, font scale 1.3): every header action is still
   reachable, via ⋯ when needed (Task 4, test `short column at 1.3x keeps every action reachable`).
3. **Split View with our app in the left half** (`useVerticalBarEdgeIOS() === "leading"`): the floating
   + sits on the left, outer edge, not next to the other app (Task 3, test `floating + follows the bar edge`).
4. **Empty Home on iOS** (no receipts): the + opens the add sheet, not the menu, and adding still works
   (Task 3, test `empty Home keeps the add sheet`).
5. **Pages outside the tabs** (export, review modals): no +, no crash (Task 3, test
   `useColumnPlusMenu outside the add flow returns no menu`).

---

### Task 1: Test harness for native Stack and crypto

About 120 of the 142 failing tests fail on `Stack.Toolbar` / `Stack.Screen` being `undefined` in each
file's own `jest.mock("expo-router", …)` factory; 5 suites fail to load `react-native-quick-crypto`
(`'QuickBase64' could not be found`).

**Files:**
- Create: `apps/mobile/test/expoRouterStack.tsx`
- Create: `apps/mobile/test/mockQuickCrypto.js`
- Modify: `apps/mobile/jest.config.js` (`setupFiles`)
- Modify: the 28 test files with `jest.mock("expo-router"` (find with `grep -rln 'jest.mock("expo-router"' src`)
- Test: `apps/mobile/test/expoRouterStack.test.tsx`

**Interfaces:**
- Produces: `export const stackMock: { Stack: StackMock }` from `test/expoRouterStack.tsx`, where
  `Stack.Screen`, `Stack.Toolbar`, `Stack.Toolbar.Button`, `.Menu`, `.MenuAction`, `.Spacer`, `.View`
  render their children (or `null` when childless) and record nothing else. Each test factory spreads it:
  `jest.mock("expo-router", () => ({ ...jest.requireActual("@/../test/expoRouterStack").stackMock, router: … }))`.
- Toolbar buttons render as a `Pressable` with `accessibilityRole="button"` and `accessibilityLabel`
  from their `accessibilityLabel` prop or text child, and call `onPress`, so tests can press header actions.

- [ ] **Step 1: Write the failing test** `test/expoRouterStack.test.tsx`: renders
  `<Stack.Toolbar placement="right"><Stack.Toolbar.Button accessibilityLabel="Export" onPress={fn} /></Stack.Toolbar>`,
  presses the button found by role `button` and name `Export`, expects `fn` called once; renders
  `<Stack.Screen options={{ title: "X" }} />` without throwing.
- [ ] **Step 2: Run it to verify it fails** — `npx jest test/expoRouterStack.test.tsx`; expected FAIL, module not found.
- [ ] **Step 3: Implement `stackMock`** in `test/expoRouterStack.tsx`, and `test/mockQuickCrypto.js` as
  `jest.mock("react-native-quick-crypto", () => ({ hkdfSync: …, randomBytes: … }))` backed by Node `crypto`;
  add it to `setupFiles` in `jest.config.js` after the gesture-handler setup.
- [ ] **Step 4: Run it to verify it passes** — same command; expected PASS.
- [ ] **Step 5: Spread `stackMock` into every `expo-router` mock factory**; keep each file's own `router`/`useLocalSearchParams` mocks.
- [ ] **Step 6: Run the formerly failing suites** —
  `npx jest src/backup src/stats src/receipts src/organize src/recurring/RecurringList src/review src/export src/errorLog src/tips src/components/ScreenHeader`;
  expected: no `reading 'Toolbar'`, `reading 'Screen'` or `QuickBase64` errors. Remaining failures are
  assertion changes owned by Tasks 2–3; list them in the commit message.
- [ ] **Step 7: Commit** — `test: shared expo-router Stack mock and quick-crypto mock for native nav`.

### Task 2: Tests follow the new route paths and the iOS/Android split

**Files:**
- Modify: `apps/mobile/src/components/settingsExportRows.test.tsx`, `settingsPicker.test.tsx`,
  `settingsTipRow.test.tsx` (import `@/app/(tabs)/(receipts,search,folders,settings)/settings`)
- Modify: `apps/mobile/src/layout/tabsLayout.test.tsx` (rewrite)
- Modify: `apps/mobile/src/layout/BottomTabBar.test.tsx`, `SideRail.test.tsx`, `sideSafeArea.test.tsx`,
  `modalSideInset.test.tsx`
- Modify: `apps/mobile/src/recurring/RuleForm.test.tsx` (`Couldn't find a navigation object`)

**Interfaces:**
- Consumes: `stackMock` (Task 1).
- `BottomTabs` and `SideRail` are Android-only on device now: their tests set `Platform.OS = "android"`
  (jest-expo runs as iOS).

- [ ] **Step 1: Fix imports** in the 3 settings tests; run `npx tsc --noEmit`; expected: no errors outside `tabsLayout.test.tsx`.
- [ ] **Step 2: Rewrite `tabsLayout.test.tsx`** with two `describe`s:
  - iOS: `TabsLayout` renders `NativeTabs` with `preferredPlacement="tabBar"` and 4 triggers named
    `index`, `search`, `folders`, `settings` (mock `expo-router/native-tabs` to record props).
  - Android (`Platform.OS = "android"`): bar layout renders `BottomTabs`; `iconRail` renders `SideRail`
    with `variant="icons"`; a pushed page inside a tab (nested `state.index > 0`) renders no bottom bar.
  Imports use the shared group paths, e.g. `@/app/(tabs)/(receipts,search,folders,settings)/folders`.
- [ ] **Step 3: Run it** — `npx jest src/layout/tabsLayout.test.tsx`; expected PASS.
- [ ] **Step 4: Set Android in `BottomTabBar.test.tsx` and `SideRail.test.tsx`**; run them; expected PASS
  (the `Cari` / `Pengaturan` label failures are the iOS path).
- [ ] **Step 5: Update `sideSafeArea.test.tsx` and `modalSideInset.test.tsx`** to the approved behaviour:
  on iOS the root does **not** pad the side inset (stack screens pad via `contentStyle`, tab roots via
  `TabScreen`); on Android the root keeps padding the side strips (folded Duo right 84 case moves to an
  Android-equivalent inset). Run both; expected PASS.
- [ ] **Step 6: Fix `RuleForm.test.tsx`**: the rule form is a native sheet now; render it inside the
  sheet route or mock `useNavigation` from `expo-router`; keep every existing assertion. Run; expected 17 PASS.
- [ ] **Step 7: Full run** — `npx jest`; expected 0 failed suites. `npx tsc --noEmit`; expected no output.
- [ ] **Step 8: Commit** — `test: native nav route paths and per-platform tab tests`.

### Task 3: Pin the + placement rules

**Files:**
- Create: `apps/mobile/src/layout/plusPlacement.test.tsx`
- Modify (only if a test exposes a gap): `apps/mobile/src/layout/TabPlus.tsx`,
  `apps/mobile/src/layout/PlusMenu.tsx`, `apps/mobile/src/layout/FloatingAddButton.tsx`

**Interfaces:**
- Consumes: `TabPlus({ home?: boolean })`, `TabStackPlus({ children, routeName })`, `useColumnPlus(): boolean`,
  `useShortColumn(): boolean`, `useColumnPlusMenu(enabled?: boolean): { menu, submenu }`,
  `SHORT_COLUMN_HEIGHT = 560`, `NativeTabsContext`. Mock `useVerticalBarEdgeIOS` and `useWindowDimensions`.

- [ ] **Step 1: Write the tests** (one `it` each):
  - `no column: floating + on every tab root` — edge `null` → `FloatingAddButton` rendered, no header +.
  - `column: Home floats, other pages put the + in the header` — edge `"trailing"`, height 874 → Home
    floating; `routeName="folder/[id]"` renders `Stack.Toolbar placement="right"` with the + menu.
  - `short column: Home's + goes into the column` — edge `"trailing"`, height 466 → no floating +, header + on `index`.
  - `no + on search, sheet, photo, recurring/[id]` — header + absent for each route name.
  - `a page that claims the + gets exactly one` — page calling `useColumnPlusMenu()` → one + menu.
  - `floating + follows the bar edge` — edge `"leading"` (Split View, left half) → floating + on the left
    (`left` set, `right` unset); edge `null` → right.
  - `empty Home keeps the add sheet` — no receipts: pressing the + calls the add sheet's `open`, no native menu.
  - `useColumnPlusMenu outside the add flow returns no menu` — no `AddReceiptProvider` → `{ menu: null, submenu: null }`, no throw.
- [ ] **Step 2: Run** — `npx jest src/layout/plusPlacement.test.tsx`. Expected: PASS except where the code
  has a real gap; for each FAIL, fix the code in the listed files (not the test) to match the spec.
- [ ] **Step 3: Run again**; expected PASS.
- [ ] **Step 4: Commit** — `test: pin + placement rules for native nav`.

### Task 4: Short column for pages without ⋯ (Recurring with rules, Tax year)

Spec open item: held sideways, these pages show Back + their buttons and no +. Resolution (applies the
spec's short-column rule): in a short column their extras (New, Export) fold into a ⋯ menu whose first
row is "Add receipt ›".

**Files:**
- Modify: `apps/mobile/src/recurring/RecurringList.tsx`
- Modify: the Tax year page (find with `grep -rln 'settings.taxYearStart\|taxYear' src/app src/settings`)
- Test: `apps/mobile/src/recurring/RecurringList.test.tsx`

**Interfaces:**
- Consumes: `useShortColumn()`, `useColumnPlusMenu()` → `{ menu, submenu }` (submenu is the "Add receipt ›" row).

- [ ] **Step 1: Write the failing tests** in `RecurringList.test.tsx`:
  - `short column folds New and Export into ⋯ with Add receipt first` — height 466, edge `"trailing"`,
    one rule → header has Back and a `More` menu whose items are, in order, `Add receipt`, `New`, `Export`.
  - `short column at 1.3x keeps every action reachable` — same plus font scale 1.3 → same items reachable.
  - `tall column keeps New, Export and the + in the header` — height 874 → buttons `New`, `Export`, then `+`.
- [ ] **Step 2: Run** — `npx jest src/recurring/RecurringList.test.tsx`; expected the first two FAIL.
- [ ] **Step 3: Implement** the fold in `RecurringList.tsx` with `Stack.Toolbar.Menu` (icon `ellipsis.circle`,
  label from the existing `common.more` key); same on the Tax year page.
- [ ] **Step 4: Run**; expected PASS.
- [ ] **Step 5: Commit** — `feat(nav): short column folds page extras and the + into ⋯ on Recurring and Tax year`.

### Task 5: Add-flow pickers become native sheets

Spec open item: the review/edit form's category and currency pickers (opened from the add flow) are
still old-style `AppModal` sheets.

**Files:**
- Modify: `apps/mobile/src/review/ReviewFields.tsx` (category and `CurrencyPicker` openers)
- Modify: `apps/mobile/src/layout/NativeSheet.tsx` (register the two sheets if the host needs it)
- Create test: `apps/mobile/src/review/ReviewFields.test.tsx`

**Interfaces:**
- Consumes: the existing `NativeSheetHost` / route `sheet` mechanism used by `FolderPicker` and the
  Settings pickers (read `FolderPicker.tsx` for the call shape and reuse it exactly).
- Android keeps `AppModal` (same split as `FolderPicker`).

- [ ] **Step 1: Write the failing tests**: on iOS, pressing the Category field opens the native sheet
  route with the category list and X / ✓ icons; choosing a category and ✓ sets it on the form; X leaves it
  unchanged. Same for Currency. On Android the `AppModal` path still renders.
- [ ] **Step 2: Run** — `npx jest src/review/ReviewFields.test.tsx`; expected FAIL.
- [ ] **Step 3: Implement** by routing both pickers through the native sheet on iOS.
- [ ] **Step 4: Run**; expected PASS. Then `npx jest src/review src/capture`; expected PASS.
- [ ] **Step 5: Commit** — `feat(nav): review form pickers open as native sheets on iOS`.

### Task 6: Keyboard keeps the second focused field visible

Spec open item: focusing a second field while the keyboard is already up does not scroll it into view.

**Files:**
- Modify: `apps/mobile/src/layout/keyboardScroll.ts` (exports `useKeyboardForm`)
- Test: `apps/mobile/src/layout/keyboardScroll.test.ts` (create if absent)

**Interfaces:**
- Consumes/keeps: `useKeyboardForm()` and its current return shape; callers (review/edit, recurring,
  export, filters, folder picker) must not change.

- [ ] **Step 1: Write the failing test** `scrolls to a second field focused while the keyboard is up`:
  keyboard shown (emit `keyboardDidShow` with height 336), focus field A (scrolled), then focus field B
  below the keyboard top → `scrollTo` called again with B visible above the keyboard.
- [ ] **Step 2: Run it**; expected FAIL (no second `scrollTo`).
- [ ] **Step 3: Implement**: scroll on every field focus while the keyboard is up, not only on `keyboardDidShow`.
- [ ] **Step 4: Run**; expected PASS.
- [ ] **Step 5: Commit** — `fix(forms): keep a newly focused field above an open keyboard`.

### Task 7: Remove spike leftovers and lint errors

**Files:**
- Rename: `apps/mobile/src/layout/navSpike.ts` → `apps/mobile/src/layout/navContext.ts` (it now holds
  only `NativeTabsContext`, `ContentInsetsContext`, `TabRootContext` and their hooks); update every import.
- Modify: every file with a `SPIKE` comment (`grep -rln SPIKE src`, excluding `src/dev/`): reword as a
  permanent explanation, keep the reason, drop "SPIKE" and "owner, date" asides.
- Modify: `apps/mobile/src/layout/NativeSheet.tsx` (lint: `useContext` called conditionally; refs read during render)
- Modify: `apps/mobile/src/app/(modals)/capture.tsx` (lint: `setState` synchronously in an effect)
- Modify: `apps/mobile/src/app/(tabs)/_layout.tsx` (the 500 ms `hidden` tab-bar workaround stays; keep its
  issue links `react-native-screens #4989 / #5115` in the comment)

- [ ] **Step 1: Rename and fix imports**; `npx tsc --noEmit`; expected no output.
- [ ] **Step 2: Fix the 3 lint errors** without changing behaviour; `npx eslint src`; expected 0 errors.
- [ ] **Step 3: Reword the SPIKE comments**; `grep -rn SPIKE src | grep -v src/dev/`; expected no output.
- [ ] **Step 4: Full checks** — `npx jest && npx tsc --noEmit && npx eslint src`; expected all pass.
- [ ] **Step 5: Commit** — `refactor(nav): drop spike names, comments and lint errors`.

### Task 8: E2E flows for native navigation

**Files:**
- Create: `apps/mobile/e2e/duo-nav.sh`
- Modify: `apps/mobile/e2e/duo-fold.sh` (taps tabs by label through the native tab bar; the rule form is a sheet now)
- Modify: `apps/mobile/e2e/README.md` (table row for `duo-nav.sh`)

**Interfaces:**
- Consumes: `e2e/lib.sh` helpers `e2e_init`, `e2e_fresh`, `posture`, `tap`, `fill`, `field_value`,
  `assert_see`, `see`, `shot`, `log`, `fail`. Runs on the iPhone Duo simulator (`06C208F7`).

- [ ] **Step 1: Write `duo-nav.sh`** with steps:
  - A (closed, upright): `tap Settings`, `tap Folders`, `tap Receipts` all work; Home shows a floating
    `Add receipt`; tapping it shows `Scan receipt`, `Import from Photos`, `Add manually`.
  - B (closed, upright): open a folder → `Back`, `Export`, `More`, `Add receipt` visible, in the column.
  - C (closed, sideways, short column): folder page → `More` contains `Add receipt`.
  - D (fold/unfold with a sheet open): open Filters from Search, `posture open`, `assert_see` the sheet;
    `posture closed`, still visible.
  - E (open, wide): tabs at the bottom of the right column (`tabBar`), no sidebar list.
- [ ] **Step 2: Run** — `E2E_ALLOW_WIPE=1 e2e/duo-nav.sh 06C208F7`; expected last line `PASS`.
- [ ] **Step 3: Update and run `duo-fold.sh`** — `E2E_ALLOW_WIPE=1 e2e/duo-fold.sh 06C208F7`; expected `PASS`.
- [ ] **Step 4: Commit** — `test(e2e): Duo native navigation flow`.

### Task 9: Device check and merge to main

- [ ] **Step 1: Full checks** — `cd apps/mobile && npx jest && npx tsc --noEmit && npx eslint src`; all pass.
- [ ] **Step 2: Owner smoke test** (owner looks, by hand): plain iPhone, iPhone Duo closed/open, iPad, Redmi
  upright and sideways — tabs, the +, one sheet, one create/edit page. Note the Auto Layout crash seen once
  after a reload (spec): report if it shows up again.
- [ ] **Step 3: Mark the spec and the session plan done**: spec status → "implemented"; session plan Phase
  F last box ticked with this plan's path.
- [ ] **Step 4: Merge** — `git switch main && git pull && git merge --no-ff spike/duo-native-nav`, run
  Step 1 again on `main`, then `git push` (retry with `git -c http.version=HTTP/1.1 push` on a sideband error).
- [ ] **Step 5: Delete the spike branch** only after the owner confirms (`git push origin --delete spike/duo-native-nav`).
