# iPhone Duo and iPad: native navigation (design)

Date: 2026-11-26. Status: draft. The direction is agreed in conversation; the details are settled in a
live review session (see the plan). Plan: `docs/superpowers/plans/2026-11-26-duo-native-navigation.md`.

## Intent

The app should feel at home on the iPhone Duo and the iPad, the way Apple's own apps do. On the Duo,
Apple moves native tab bars, toolbars and headers into a side column on the outer screen and a sidebar
on the inner screen. Our navigation is drawn by us (`expo-router/js-tabs` with `BottomTabs` and
`SideRail`, root `Stack` with `headerShown: false`), so none of that happens for us today.

The target users are privacy-minded people leaving cloud apps, people who want a free app, and older
users who want a simple app. Standard, familiar controls with large tap targets serve all of them.

## Decisions so far (owner)

- Go toward native navigation (option "B"), staged. The release date is not the constraint.
- The + stays at the bottom, near the thumb.
- Today's + behaviour stays for now: it opens the add sheet **over** the current screen. That is the
  better experience than switching to an "Add" page.
- Later, not now: the + expands into a menu (Scan receipt / Import photo / Type it in), in Apple's
  native menu style with an icon and a word on each row ("option 1" of the mockups). No icon-only
  bubbles: older users need the words.
- Work style: live review. The owner looks at the running app on the simulators and the Redmi, screen
  by screen, and approves directly. No throwaway screenshot spike.
- Positioning first. `@expo/ui` is not needed for this stage.
- **Native tabs on iPhone and iPad only; Android keeps today's bottom bar and side rail** (confirmed
  2026-11-26). Reason: the installed expo-router's `NativeTabs` has no side rail or sidebar on Android
  (bottom bar only), which would be a step back on the Z Fold, Pixel Fold and Android tablets.
- **Thumb reach on big screens** (approved 2026-11-26). Held in two hands, thumbs reach the lower half of
  both side edges; the top corners are the hardest. So:
  - Android side rail (ours, `src/layout/SideRail.tsx`): group the tabs at the **bottom**, just above the
    +, instead of the top (Material: rail items may be top, center or bottom aligned; bottom alignment is
    easier for thumbs on tablets). Short windows keep scrolling.
  - iOS open Duo held wide: compare Apple's `preferredPlacement="sidebar"` (left list, top) with
    `"tabBar"` (tabs in the right side column, at the bottom, like the closed Duo) in the live session.
    Lean: `tabBar`, for thumb reach and the same place as the closed screen.
  - iPad: Apple's default; the + stays bottom-right.
- **Split View is checked on every device** (approved 2026-11-26). In a split, controls belong on the
  window's **outer** edge, away from the middle (Apple: an app in the left half puts its bars on the
  left edge). The + must follow: a floating + (variant C) reads the bar edge with
  `useVerticalBarEdgeIOS()` (`expo-status-bar`: `'leading'`, `'trailing'` or `null`) and sits on that
  side, never at the inner edge next to the other app; a native toolbar + (variant D) moves by itself.

## Facts found (2026-11-26)

- Expo SDK 58 is current: `expo 58.0.26`, `npx expo install --check` "Dependencies are up to date",
  `expo-doctor` 20/20 passed.
- Apple (Tech Talk 111466, "Design for iPhone Duo"): only system bars move into the side column;
  custom views are left out. Top-bar items go to the top of the column, bottom-bar items to the bottom,
  the tab bar stays bottom-aligned. Inner screen: tab bar can become a sidebar. System sheets, alerts,
  menus and toolbar buttons avoid the fold on their own.
- Expo blog "Supporting iPhone Duo": use `Stack` and `NativeTabs`; JS tab bars in the vertical rail are
  intentionally not supported; floating views use `insets.right + 16`; read window size at render time;
  inside `NativeTabs` screens do not add a fixed tab-bar height (`insets.bottom` already includes it).
- Installed `expo-router` 58.0.32, `NativeTabs` (`expo-router/native-tabs` types):
  - `preferredPlacement` (`'sidebar' | 'tabBar' | 'automatic'`, iOS 27+), `sidebarAdaptable` (iOS 18+).
  - Trigger `prominent` (iOS 27+): the tab on its own surface; still a tab (a page), not a button.
  - Trigger `disabled`: tab stays visible but inert; `tabPress` still fires (`canPreventDefault: false`).
  - `NativeTabs.BottomAccessory` (iOS 26+): a bar for things like a mini player.
  - No Android rail or sidebar.
- `Stack.Toolbar` (expo-router): `placement` `'left' | 'right' | 'bottom'` (default bottom), with
  `Stack.Toolbar.Button`, `.Menu`, `.Spacer`, `.View`. Toolbars belong to a native stack screen.
- `@expo/ui` 58.0.29 is installed and has `Menu`, `GlassEffectContainer`, `Namespace`, `ArrangementView`
  (for the later menu and fold work).

## Where the + can go (approaches)

| | What | Keeps today's sheet | Near thumb on Duo | Verdict |
|---|---|---|---|---|
| A | `prominent` tab that opens an "Add" page | no (page) | yes | follows Apple's rules, worse UX; not chosen |
| B | Native header + (top right) | yes | no (top of column) | not chosen |
| — | `disabled` prominent tab whose `tabPress` opens the sheet | yes | yes | rejected: uses a tab as an action, against Apple's tab-bar guidance |
| C | Our floating + beside the side column (`insets.right + 16`) | yes | yes | candidate, fallback |
| D | Native bottom toolbar button (`Stack.Toolbar placement="bottom"`) | yes | yes, inside the column | candidate, best if iPhone shows it well next to the tab bar |

C and D are compared live in the session. D needs each tab wrapped in its own `Stack` (toolbars belong
to a stack screen), which changes the route structure; try it on the Receipts tab first.

## Goals

- iOS: `NativeTabs` for the 4 tabs (Receipts, Search, Folders, Settings); sidebar on the open Duo and
  the iPad.
- The + in the best of C or D, opening today's add sheet.
- Screen actions that are our own buttons today become native toolbar items, so they move into the side
  column (folder: Export, Rename, Delete; review: Discard, Save; and the rest found in the sweep).

## Non-goals (this stage)

- The expanding + menu.
- Fold avoidance for controls inside screens (Tip jar prices, "Add manually", "Restore"):
  `ArrangementView` or `react-native-reserved-regions` / `expo-hinge`, Phase 2 of
  `2026-11-17-foldable-readiness-design.md`.
- Android navigation changes.
- The Duo store listing (start the Duo screenshot sets with app screens): a separate small task.

## Anti-goals

- Losing today's "sheet over the current screen" add flow.
- Breaking Android or the plain iPhone.
- Tying a feature to one pose or one display.

## Open questions the live session answers

1. Do `NativeTabs` land at the bottom of the Duo's side column when closed, and as a sidebar when open?
2. Does a bottom toolbar (D) show well together with the tab bar on a plain iPhone?
3. What does the native tab bar look like next to our slip design (our capsule style goes away on iOS)?
4. Does the current dev build already contain the native tab code (`react-native-screens`)? Expected yes.
5. In Split View (Duo inner, iPad, Android foldables and tablets), where do the tabs, rail and + land, and
   are they on the outer edge and reachable?

## Session results: iPhone Duo outer screen (2026-11-26) — DONE

Owner approved the closed Duo (outer screen), held upright and held sideways. All work is on branch
`spike/duo-native-nav` (23 commits, last `fabaa35`), not on `main`. Dev switches live in Settings →
Developer tools (tab placement; + variant B/C/D/E). Default is B.

Answers to the open questions: (1) yes, NativeTabs land at the bottom of the side column once the root
stops padding the side inset (see below); (2) D does not work on the Duo (the bottom toolbar + sits behind
the tab bar); plain iPhone still to check; (4) yes, the dev build has the native tab code, no rebuild.

### What was decided and built

- **Native tabs on iOS** (`src/app/(tabs)/_layout.tsx`): 4 tabs with SF Symbols. Android unchanged.
- **Root cause of "tabs not in the column":** `SideSafeArea` padded the root by the 84 pt side inset, so
  no native bar reached the column. On iOS the root no longer pads; stack screens pad via `contentStyle`,
  tab roots via `TabScreen`. Receipts' green slip runs full width under the column; rows pad by the inset.
- **Per-tab stacks** (shared group `(tabs)/(receipts,search,folders,settings)/`, anchors in
  `unstable_settings`): pages opened from a tab keep the tab bar. Android: phone bottom bar hides on pushed
  pages, rail stays.
- **Native headers** on every page with Back (`ScreenHeader` → native header on iOS): Back, then the page's
  own buttons, then the + last (receipt detail: Back, ✏️ Edit, ⋯ More, +).
- **The + (variant B)**: in the side column on every page when the window has a side column; Home keeps a
  floating + bottom-right (upright). The + opens Apple's menu: Scan receipt / Import from Photos / Add
  manually (icon + word), each starting that flow directly (no add sheet). Home + uses `@expo/ui` Menu.
  No column → floating + (plain iPhone, iPad). Empty Home and Android keep the add sheet.
- **Short column** (window height < 560 pt, Duo held sideways): page extras fold into ⋯ (Edit, Export), the
  + becomes an "Add receipt ›" submenu row at the top of ⋯; pages without ⋯ keep Back + + in the column;
  Home's + goes into the column (no floating +).
- **Search**: normal tab (Apple's search tab role dropped: doubled header items, Filter stopped working);
  native search field at the top; Filter in the column; no + on Search.
- **Sheets** (native sheet pages via `NativeSheetHost` + route `sheet`): Filters, folder/category forms,
  folder picker, Info, Language/Currency/Tax year/Pay cycle pickers. Icons X (cancel) and green ✓ (done) in
  the bottom toolbar = bottom of the Duo column. Text buttons stay in a sheet's top bar; icons move.
- **Create/edit pages** have no tabs and no +, only X and ✓: recurring rule form (now a sheet), Export,
  review/edit receipt (Discard = trash at top, review only; rule Delete stays in the page).
- **Photo viewer**: native black full-screen page, white status icons, green ✓ at the bottom of the column.
- **Keyboard**: `useKeyboardForm()` gives forms keyboard-height bottom room and scrolls the focused field
  above the keyboard (review/edit, recurring, export, filters, folder picker).
- **Crash fixed**: pages outside the tabs no longer ask for the add flow (`useMaybeAddReceiptContext`).

### Still open (next sessions)

- B4–B9: open Duo held wide (sidebar vs tabBar), held tall, half open, Split View, PiP, fold with a sheet open.
- Recurring with rules and Tax year show no + when held sideways (Back + New / Export, no ⋯). Owner to decide.
- Second field focused while the keyboard is already up does not auto-scroll.
- Review/edit and other sheets opened from the add flow (its category/currency pickers) still old style.
- Phase C (Android/Redmi), D (plain iPhone: X/✓ bottom toolbar vs tab bar, worst-case text sizes),
  E (iPad).
- Tests: tabsLayout.test.tsx (16 fail: jest runs as iOS) and tests importing old route paths
  (`@/app/(tabs)/settings` etc.) need updating in the real implementation plan.
- One native crash seen once right after a reload (Auto Layout exception in a navigation transition), not
  reproduced.
