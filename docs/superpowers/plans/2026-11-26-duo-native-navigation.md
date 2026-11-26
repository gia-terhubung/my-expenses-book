# Duo Native Navigation: Live Session Plan

> **For agentic workers:** this is a live review session, not a batch plan. Work one checkpoint at a
> time: make the change, let Metro reload, ask the owner to look, wait for "approved" or changes. Do not
> run ahead to the next checkpoint. Read the spec first.

**Goal:** On iOS, move the app to Apple's native tabs and toolbars so the iPhone Duo side column, the
Duo/iPad sidebar and fold-safe system controls work, with the + still near the thumb and still opening
today's add sheet. Android stays as it is.

**Spec:** `docs/superpowers/specs/2026-11-26-duo-native-navigation-design.md` (decisions, facts, the C/D
choice for the +, non-goals). Read it in full before Checkpoint 0.

**Tech:** Expo SDK 58 (`expo 58.0.26`), `expo-router 58.0.32` (`expo-router/native-tabs`,
`Stack.Toolbar`), React Native 0.88.1. No new dependencies.

## Global constraints

- Branch `spike/duo-native-nav`. Never on `main` until the owner approves the end result.
- No new dependencies. `@expo/ui` is not used in this stage.
- The + always opens today's add sheet (`useAddReceiptContext().open()` from
  `src/capture/AddReceiptProvider.tsx`).
- Android code paths unchanged: `BottomTabs` (`src/layout/BottomTabBar.tsx`), `SideRail`
  (`src/layout/SideRail.tsx`), `layoutFor()` (`src/layout/layout.ts`).
- Layout by available width only; never by device model (`src/layout/windowClass.ts` rule).
- Copy from `src/i18n/locales/*.json`; tab labels from `TAB_LABEL_KEYS` (`src/layout/tabs.ts`).

## Devices for the session

- iPhone Duo simulator (Xcode 27.x; poses via Xcode → Open Developer Tool → Device Hub: closed, open,
  partially open, rotate). The owner sets poses by hand.
- A plain iPhone simulator, and an iPad simulator.
- Redmi 14C over adb (Android sanity only).
- Metro: in `apps/mobile`, `npx expo start --dev-client`.

## Checkpoint 0: setup

- [ ] `git switch -c spike/duo-native-nav`.
- [ ] Ask the owner: "Native tabs on iPhone/iPad only, Android unchanged?" (spec, "To confirm").
- [ ] Start Metro, open the app on the Duo simulator, iPad simulator and Redmi. If the iOS dev build
      fails on `NativeTabs` (missing native code), rebuild the dev client once
      (`eas build --profile development --platform ios --local` or the project's usual path) and say so.

## Checkpoint 1: native tabs on iOS

**Files:** `src/app/(tabs)/_layout.tsx`, `src/layout/useTabBarSpace.ts`, `src/layout/tabs.ts`.

- [ ] In `(tabs)/_layout.tsx`, branch on `Platform.OS`: `ios` renders `NativeTabs` with 4
      `NativeTabs.Trigger`s in `TAB_ROUTES` order; everything else renders today's `Tabs` code unchanged.
      Both inside `AddReceiptProvider`.
- [ ] Add SF Symbol names per tab to `tabs.ts` (`TAB_SF_SYMBOLS`): `doc.text`, `magnifyingglass`,
      `folder`, `gearshape`. Labels from `TAB_LABEL_KEYS`.
- [ ] `NativeTabs preferredPlacement="sidebar"` (try `"automatic"` too if the owner wants to compare).
- [ ] `useTabBarSpace()` returns 0 under `NativeTabs` (Expo: `insets.bottom` already includes the bar).
- [ ] The + is temporarily the floating variant (C), so adding still works: extract the round + from
      `BottomTabs` into `src/layout/FloatingAddButton.tsx`, absolute, `right: insets.right + 16`,
      `bottom: insets.bottom + 16`, `onPress` = `open()`.
- [ ] **Owner reviews:** plain iPhone; Duo closed (tabs at the bottom of the right column?), Duo open
      wide (sidebar?), Duo open tall, Duo half open; iPad. Note what the owner says about the look of
      the native tab bar next to the slip header.

## Checkpoint 2: where the + lives (C vs D)

- [ ] C is already in place from Checkpoint 1.
- [ ] D on the Receipts tab only: wrap the Receipts tab in its own `Stack` (move `(tabs)/index.tsx` to
      `(tabs)/(receipts)/index.tsx` with a `(receipts)/_layout.tsx` `Stack`, `headerShown: false` except
      what the toolbar needs), add `Stack.Toolbar placement="bottom"` with one `Stack.Toolbar.Button`
      (icon `plus`, label "Add receipt") whose press calls `open()`.
- [ ] A dev-only switch (Settings → Developer tools, or a constant) toggles C and D.
- [ ] **Owner reviews** both on: plain iPhone (does the bottom toolbar sit well with the tab bar?), Duo
      closed (is D inside the column, near the thumb?), Duo open, iPad. **Owner picks C or D.**
- [ ] Record the pick and the reason in the spec under a new heading "Session results".

## Checkpoint 3: native header buttons, one screen

- [ ] Folder screen (`src/organize/CollectionScreen.tsx`, route `src/app/folder/[id].tsx`): show the
      native header and move Export to `Stack.Toolbar placement="right"` as a button, Rename and Delete
      into a `Stack.Toolbar.Menu` ("⋯"). Keep the Delete confirmation as it is today.
- [ ] **Owner reviews** on Duo closed (Back, Export, ⋯ at the top of the column), plain iPhone, iPad.

## Checkpoint 4: Android sanity

- [ ] Redmi: tabs, the +, the add sheet and the folder screen look and work exactly as before.

## Checkpoint 5: wrap up the session

- [ ] Write "Session results" in the spec: tab placement, + variant, header pattern, anything the owner
      rejected, screenshots if the owner wants them kept.
- [ ] Owner approves the spec. Then run superpowers:writing-plans for the real implementation from the
      spike's approved code: the remaining screens with own action buttons (found by the sweep:
      `src/review/ReceiptFormScreen.tsx` Discard/Save, `src/organize/CategoriesScreen.tsx`,
      `CategoryForm.tsx`, `FolderForm.tsx`, plus any other custom header), tests
      (`src/layout/tabsLayout.test.tsx`, `useTabBarSpace`, new `FloatingAddButton` or toolbar test),
      and the e2e AXe fold flows. Keep the spike branch until that plan is done.

## Review focus (for the later real implementation)

1. Folding or unfolding with the add sheet open keeps the sheet (today's `AddReceiptProvider` guarantee).
2. Selected tab and open receipt survive fold, unfold and rotation (`pendingSelection.ts`).
3. Split View at 469 pt wide (left window): phone layout, + reachable, nothing under the side column.
4. VoiceOver reads every native toolbar item with a label (Apple requires a symbol and a title).
5. Android unchanged on the Redmi and a foldable emulator.
