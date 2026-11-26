# Duo Native Navigation: Live Session Plan

> **For agentic workers:** this is a live review session, ordered **by device** so the owner opens each
> simulator or phone once: first build all the iOS changes, then review everything on the iPhone Duo,
> then the Android changes and the Redmi (plus Android emulators), then the iPad and the plain iPhone.
> Within a device pass, show one item at a time, wait for "approved" or changes, fix on the spot, then go
> to the next item. Do not switch devices until the current pass is done. Read the spec first.

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
- Android code paths unchanged except the rail alignment (Phase C): `BottomTabs`
  (`src/layout/BottomTabBar.tsx`), `SideRail` (`src/layout/SideRail.tsx`), `layoutFor()` (`src/layout/layout.ts`).
- Layout by available width only; never by device model (`src/layout/windowClass.ts` rule).
- Copy from `src/i18n/locales/*.json`; tab labels from `TAB_LABEL_KEYS` (`src/layout/tabs.ts`).

## Devices for the session

- iPhone Duo simulator (Xcode 27.x; poses via Xcode → Open Developer Tool → Device Hub: closed, open,
  partially open, rotate). The owner sets poses by hand.
- A plain iPhone simulator, and an iPad simulator.
- Redmi 14C over adb (upright, sideways, and split screen).
- Android Studio emulators: a foldable (Z Fold or Pixel Fold) and a tablet, for the rail and split screen.
- Metro: in `apps/mobile`, `npx expo start --dev-client`.

## Phase A: build every iOS change (no device review yet)

Do all of this first, so the Duo pass needs no rebuilds or restarts. Check that the app launches on the
Duo simulator after each step; the owner does not review yet.

- [ ] A1 Setup: `git switch -c spike/duo-native-nav`; start Metro; open the app on the **Duo simulator
      only**. If the iOS dev build fails on `NativeTabs` (missing native code), rebuild the dev client once
      (`eas build --profile development --platform ios --local` or the project's usual path) and say so.
- [ ] A2 Native tabs (`src/app/(tabs)/_layout.tsx`, `src/layout/tabs.ts`, `src/layout/useTabBarSpace.ts`):
  - branch on `Platform.OS`: `ios` renders `NativeTabs` with 4 `NativeTabs.Trigger`s in `TAB_ROUTES`
    order; everything else renders today's `Tabs` code unchanged; both inside `AddReceiptProvider`;
  - SF Symbols per tab in `tabs.ts` (`TAB_SF_SYMBOLS`): `doc.text`, `magnifyingglass`, `folder`,
    `gearshape`; labels from `TAB_LABEL_KEYS`;
  - `useTabBarSpace()` returns 0 under `NativeTabs` (Expo: `insets.bottom` already includes the bar).
- [ ] A3 Dev-only switches (Settings → Developer tools, or constants), so the owner can compare without
      a restart: tab placement `sidebar` / `tabBar`; + variant C / D.
- [ ] A4 + variant C (floating): extract the round + from `BottomTabs` into
      `src/layout/FloatingAddButton.tsx`, absolute, `bottom: insets.bottom + 16`, on the side
      `useVerticalBarEdgeIOS()` returns (`'leading'` = left with `insets.left + 16`, `'trailing'` or
      `null` = right with `insets.right + 16`), `onPress` = `open()`. In a split it must sit on the
      window's outer edge (spec, "Split View").
- [ ] A5 + variant D (native bottom toolbar) on the Receipts tab only: wrap the tab in its own `Stack`
      (move `(tabs)/index.tsx` to `(tabs)/(receipts)/index.tsx` with a `(receipts)/_layout.tsx` `Stack`),
      add `Stack.Toolbar placement="bottom"` with one `Stack.Toolbar.Button` (icon `plus`, label
      "Add receipt") whose press calls `open()`.
- [ ] A6 Folder screen header (`src/organize/CollectionScreen.tsx`, route `src/app/folder/[id].tsx`):
      native header; Export as `Stack.Toolbar placement="right"` button; Rename and Delete in a
      `Stack.Toolbar.Menu` ("⋯"). Keep today's Delete confirmation.

## Phase B: iPhone Duo pass (one simulator session)

The owner sets each pose in Device Hub. Show one item at a time; fix small things on the spot.

- [ ] B1 Closed: tabs at the bottom of the right side column? Look of the native tab bar next to the slip
      header?
- [ ] B2 Closed: + variant C (floating, beside the column) against D (inside the column). Provisional
      pick; it is confirmed on the plain iPhone in Phase D.
- [ ] B3 Closed: folder screen; Back, Export and ⋯ at the top of the column.
- [ ] B4 Open, held wide: `sidebar` against `tabBar` placement (lean `tabBar`). **Owner picks.**
- [ ] B5 Open, held tall: horizontal bars; + position.
- [ ] B6 Half open (book and tabletop): nothing tappable in the fold band from the tabs or the +.
- [ ] B7 Split View 50/50: our app in the left half (469 pt) and in the right half; phone layout; bars
      and + on the outer edge.
- [ ] B8 A pinned picture-in-picture video at the top: the app gets shorter; tabs and + still reachable.
- [ ] B9 Fold and unfold with the add sheet open: the sheet stays.
- [ ] B10 Write the Duo results into the spec under "Session results". Close the Duo simulator.

## Phase C: Android pass (Redmi, then emulators)

- [ ] C1 Rail at the bottom (`src/layout/SideRail.tsx`, `src/layout/SideRail.test.tsx`): the rail's
      `ScrollView` content grows to fill (`flexGrow: 1`) and aligns to the end (`justifyContent:
      "flex-end"`), so the tabs sit just above the +. Short windows still scroll and every tab stays
      reachable above the + (the landscape-phone fix in commit 8928d88 must still hold). Update the test.
- [ ] C2 Redmi upright: tabs, the +, the add sheet and the folder screen exactly as before.
- [ ] C3 Redmi held sideways: icon rail with the tabs at the bottom, above the +.
- [ ] C4 Redmi split screen top and bottom: short window; tabs, + and the add sheet usable.
- [ ] C5 Android foldable emulator (Z Fold or Pixel Fold): unfolded rail at the bottom; split screen side by
      side, our app in each half.
- [ ] C6 Android tablet emulator: wide rail at the bottom; split screen, each half (rail or bottom bar by
      width).
- [ ] C7 Write the Android results into the spec.

## Phase D: iPad and plain iPhone pass

Both are iOS simulators; open them together.

- [ ] D1 Plain iPhone: native tab bar; + variant C against D: does the bottom toolbar sit well with the
      tab bar? **Confirm the + pick from B2.** Folder screen header.
- [ ] D2 iPad full screen: Apple's default placement; + bottom-right; folder screen header.
- [ ] D3 iPad Split View (half and one third) and Slide Over: compact width, tab bar, + on the outer edge.
- [ ] D4 Write the iPad and iPhone results into the spec.

## Phase E: wrap up the session

- [ ] Finish "Session results" in the spec: tab placement, + variant, header pattern, anything the owner
      rejected, screenshots if the owner wants them kept. Remove the dev-only switches from the plan of
      record (they stay only on the spike branch).
- [ ] Owner approves the spec. Then run superpowers:writing-plans for the real implementation from the
      spike's approved code: the remaining screens with own action buttons (found by the sweep:
      `src/review/ReceiptFormScreen.tsx` Discard/Save, `src/organize/CategoriesScreen.tsx`,
      `CategoryForm.tsx`, `FolderForm.tsx`, plus any other custom header), tests
      (`src/layout/tabsLayout.test.tsx`, `useTabBarSpace`, `SideRail.test.tsx`, the + variant), and the
      e2e AXe fold flows. Keep the spike branch until that plan is done.

## Review focus (for the later real implementation)

1. Folding or unfolding with the add sheet open keeps the sheet (today's `AddReceiptProvider` guarantee).
2. Selected tab and open receipt survive fold, unfold and rotation (`pendingSelection.ts`).
3. Split View (469 pt left window on the Duo, iPad thirds, Android halves): phone layout, bars and + on the
   outer edge, nothing under the side column.
4. VoiceOver reads every native toolbar item with a label (Apple requires a symbol and a title).
5. Android unchanged on the Redmi and a foldable emulator.
