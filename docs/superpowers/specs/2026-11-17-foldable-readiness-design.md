# Foldable readiness: iPhone Duo, Galaxy Z Fold / Z Flip, Pixel Fold

Date: 2026-11-17. Branch audited: `fix/device-findings` at d3e6048. Status: design spec, nothing implemented.

Evidence: 57 screenshots from the iPhone Duo simulator (Xcode 27.2, iOS 27.2 SDK) in
`/private/tmp/claude-501/-Users-giaendong-Documents-Terhubung-SP-My-Expenses-Book/781fb161-ab02-4cd4-87e0-997f320ab4e6/scratchpad/ios/fold/`
(called `fold/` below). That folder is a session scratchpad and can be cleared; copy the files named in
this spec into `docs/` if they should be kept. Android was not run: every Android row is reasoning from
code and documentation and is marked "not run".

## 1. Intent

The owner's request: the app must be ready for the iPhone Duo and for Android foldables, in every way the
screen can be held, not only "closed" and "open".

The live pass shows the app is not ready today. A person who starts the app on the Duo's outer screen and
opens the phone loses the receipt list (finding F1). A person who holds the open Duo upright gets three
squeezed columns, and in one reproducible case a receipt detail one letter wide (F2). These are layout
bugs in our own code, not missing fold features.

The recommendation is two phases:

- **Phase 1 (do before ship, JavaScript only, no new native dependency, no rebuild):** decide the layout
  from the space the content really has, make the pane widths deterministic, keep modals and sheets inside
  the safe area, and keep one add-receipt sheet alive across fold and unfold. This fixes every bug below.
- **Phase 2 (after a pass on real hardware, needs a native module and a dev rebuild):** read the fold
  position so that the list/detail divider sits on the hinge and so that the Tip jar and the review form
  use the two halves in tabletop and book posture. This is polish. It is not needed for the app to be
  correct, and it should not be built before someone has held a real device.

Design language stays the Ledger-slip redesign (`2026-11-16-ledger-slip-redesign-design.md`): same
tokens, no new colours, the slip header, the floating duo bar, tonal for selected, hairline borders.

## 2. What the platforms give us

### iPhone Duo (measured on the simulator, plus secondary sources)

Apple's own documentation pages were not reachable in this pass. API names below come from third-party
write-ups of the iOS 27.1 SDK and must be checked against developer.apple.com before Phase 2 is built.
The measurements are from the simulator.

| Fact | Value | Source |
|---|---|---|
| Outer screen, upright | 466 x 678 pt, safe inset right 84, top 0 (status area is a vertical strip on the right) | measured |
| Outer screen, sideways | 678 x 466 pt, safe inset 84 on the side that holds the camera | measured (`fold/03`, `fold/25`) |
| Inner screen, landscape | 951 x 669 pt, safe inset right 84 (content 867 wide), top 0 | measured |
| Inner screen, portrait | 669 x 951 pt, safe inset top 82, sides 0 (status area top right) | measured |
| Fold line | Inner landscape: vertical at x = 475.5. Inner portrait: horizontal at y = 475.5 | derived from the two 466 pt halves |
| Fold region | 40 pt wide, centred on the fold; active only when partly open | `expo-foldables` README (unverified) |
| Outer to inner switch while opening | between 86 and 100 degrees | measured |
| Inner to outer switch while closing | between 70 and 60 degrees | measured |
| Postures the hinge API reports | closed, partially open, fully open (plus a continuous angle) | secondary |
| What React Native sees when the hinge moves from 180 to 60 degrees | nothing: same window size, same safe-area insets, identical element frames | measured (`fold/01`, `fold/02-portrait-120`, `fold/02-portrait-90`, `fold/08-landscape-book-90`) |

So in React Native a fold or unfold is only a window resize plus new safe-area insets. Tabletop (inner
portrait, half open) and book (inner landscape, half open) are invisible to JavaScript today.

Native APIs that exist in the iOS 27.1 SDK (secondary sources):

- Hinge: `UIHingeInteraction` / SwiftUI `onHingeChange`. Meant for effects, not layout.
- Reserved regions: `UIView.reservedRegions(kind:options:)`, kinds `.division` (the fold) and
  `.occlusion` (camera). This is the layout API.
- `UIArrangementViewController` / `ArrangementView`: a two-part container that follows the fold.
- Vertical bars: standard navigation and toolbar buttons move into the vertical status strip. Our tab bar
  and rail are custom views, so they do not take part. Only the native back button and title do.
- Split View on the inner screen is 50/50 and an app cannot opt out. Supported-orientation limits do not
  lock the inner screen.
- Apps built with the iOS 27 SDK must use the UIScene lifecycle. Our `Info.plist` already has
  `UIApplicationSceneManifest`, and the app launches.

### Android (not run)

- Jetpack WindowManager `FoldingFeature`: `state` (FLAT, HALF_OPENED), `orientation` (HORIZONTAL,
  VERTICAL), `occlusionType` (NONE, FULL), `isSeparating`, `bounds`. Tabletop is HALF_OPENED with a
  horizontal fold. Book is HALF_OPENED with a vertical fold. The hinge angle is not part of this API.
- Window size classes by width: compact below 600 dp, medium 600 to 839, expanded 840 and up. The app
  already uses these breakpoints (`src/layout/windowClass.ts`).
- Android 16 (API 36) ignores orientation, aspect-ratio and resizability limits on displays with a
  smallest width of 600 dp or more. Cover screens and flip phones are below that and keep the old rules.
  The app sets no such limits (`screenOrientation="unspecified"`, `resizeableActivity` left at its default
  of true), so nothing changes for us.
- Approximate window sizes, to be confirmed on devices: Z Fold cover about 370 to 410 dp wide (compact);
  Z Fold inner about 690 to 770 dp wide and 830 to 850 dp tall (medium in both orientations); Pixel Fold
  (first generation) inner about 841 x 701 dp in landscape (just expanded); Pixel 9 Pro Fold inner about
  790 x 820 dp (medium); Z Flip main screen about 360 x 880 dp (compact); Z Flip cover screen roughly
  300 to 360 dp square, and third-party apps run there only when the user enables them.
- Samsung Flex mode can shrink the app window to the top half of the screen. To the app this is a resize
  to a short window.

### React Native and Expo

- `useWindowDimensions()` and `react-native-safe-area-context` are the only inputs available without a
  native dependency. Both update on fold, unfold and rotation (measured on the Duo).
- `expo-foldables` (third party) exposes posture, angle and fold bounds on iOS and Android. It is too
  young to depend on: 20 commits, 3 stars, no visible release. It is a native module, so it needs a dev
  rebuild, and it installs its own UIScene config plugin.
- The repo already has a local Expo module (`apps/mobile/modules/receipt-ocr`). A second small local
  module is the better route for Phase 2 (section 6, change P2-1).

## 3. Posture and screen matrix

"Bug" means a person cannot do the task or sees broken layout. File names are in `fold/`.

| Posture / screen | Window the app gets | What the app does today | What it should do |
|---|---|---|---|
| **Duo closed, upright** (outer) | 466 x 678, content 382 | Works. Slip, list, floating duo bar; status strip on the right is empty page colour. `05-closed-outer-portrait.png`, `13-closed-feed-with-receipts.png`, `14-closed-document-pushed.png` | Keep. Compact layout. |
| **Duo closed, sideways** (outer landscape) | 678 x 466, content 594 | **Bug.** Treated as medium: 200 pt rail plus two panes on a phone-sized screen. The rail is inset twice (items 99 pt wide), list 330, detail 63. `03-outer-landscape-10.png`, `04-closed-outer-landscape.png` | Content width 594 is below 600: duo bar, one pane. Slip header in its short form (window height below 480). |
| **Duo half open, tabletop** (inner portrait, about 90 degrees, fold horizontal at y 475) | 669 x 951 | Same layout as open portrait (see that row for its bugs). No fold information reaches the app. Controls land on the crease: "Add manually" at y 429 to 477 (`02-portrait-90.png`), Tip jar price buttons at y 490 to 538 (`29-tabletop-tipjar.png`), "Restore" heading at y 447 (`24-tabletop-backup.png`). | Phase 1: single pane with the icon rail; scrolling content may cross the fold. Phase 2: Tip jar puts the counter above the fold and the prices below; review form puts the receipt image above and the fields below; fixed controls stay out of the 40 pt fold region. |
| **Duo half open, book** (inner landscape, about 90 to 120 degrees, fold vertical at x 475) | 951 x 669, content 867 | Same as open landscape. The list/detail divider is at x 467, 8 pt left of the fold, by luck. The review form card (x 149 to 802) and the add sheet (full width) straddle the fold. `08-landscape-book-90.png`, `11-book90-form-typed.png`, `34-book-addsheet.png`, `31-book-tipjar.png` | Phase 1: two panes, divider near the fold (x 480). Phase 2: divider exactly on the fold, rail and list on the left leaf, detail on the right leaf; the review form splits image left, fields right on the fold. |
| **Duo open, landscape** (inner) | 951 x 669, content 867 | Good only if the app was started in this state: rail 200, list 266, detail 400 (`16-open-landscape-twopane-selected.png`). **Bug** after a start on the outer screen: the list pane is gone (`44-coldstart-closed-then-open-landscape.png`, `36-open-landscape-after-roundtrip.png`). | Rail 200 with icons, list 280, detail 387, always, whatever state the app started in. |
| **Duo open, portrait** (inner) | 669 x 951, top inset 82 | **Bug.** Rail 200, list 234, detail 234: merchant names cut to "Apot..." (`21-open-portrait-twopane-fresh-mount.png`, `45-coldstart-closed-then-open-portrait.png`). After coming from landscape: list 407, detail 61, the receipt title one letter per line (`19-open-portrait-twopane-selected.png`); empty state list 367, detail 101 (`00-start-inner-portrait-131.png`). An 82 pt blank band sits above the slip. | Icon rail 72, one pane 597 wide; a selected receipt replaces the list with a back control (the existing compact behaviour). The band above the list is slip green. |
| **Duo transitions** (fold, unfold, rotate) | resize only | Kept: typed form text (`10`, `11`, `12`), selected receipt in two-pane to detail with back and return (`16`, `17`, `18`), pushed Backup and Tip jar (`23` to `25`, `28` to `32`), selected tab, scroll position within 82 pt (`26`, `27`). Lost: the add sheet when opened from the duo bar and then unfolded (`06-closed-addsheet.png` to `07-open-landscape-addsheet.png`). Changed for the worse: a receipt pushed while closed becomes a stretched full-width page with no list after unfold (`15-open-landscape-document-pushed.png`). | Everything a person has open stays open. The add sheet survives both directions. A pushed receipt becomes the selected receipt in two-pane after unfold. |
| **Duo Split View** (inner, 50/50) | about 475 x 669 minus insets | Not run (the simulator tooling could not start Split View). By the rules it is compact. | Compact layout, same as closed. Verify on device. |
| **Z Fold cover** | about 370 to 410 dp wide | Not run. Compact; same as a narrow phone, which is verified on the Redmi (360 dp). | Compact. |
| **Z Fold inner** | about 690 to 770 dp wide, medium | Not run. By code: rail 200 plus two panes of about 245 to 285 dp. Same squeeze as F2, and the same list-pane loss as F1 is likely because the usual start is on the cover screen. | Icon rail 72; two panes when the pane area is 600 dp or more (list 280, detail 338 or more), else one pane. |
| **Z Fold flex mode** (half open, hinge horizontal) | full window, or the top half if the user turns on the Flex mode panel | Not run. No posture handling. With the Flex panel the window is short (about 400 dp). | Phase 1: short-window rule (condensed slip header). Phase 2: same tabletop layouts as the Duo. |
| **Z Flip main screen** | about 360 x 880 dp | Not run. Compact. The deferred Z Flip rows in `docs/redesign-acceptance.md` still stand. | Compact. |
| **Z Flip flex mode** | top half, about 360 x 420 dp, when the Flex panel is on | Not run. The slip header (152 dp) plus the duo bar (about 100 dp) leave about 170 dp for receipts. | Short-window rule: condensed slip header. |
| **Z Flip cover screen** | roughly 300 to 360 dp square | Not run. Only when the user enables the app there. | Must not break: compact, short-window rule, duo bar labels already shrink. No dedicated layout. |
| **Pixel Fold / Pixel 9 Pro Fold inner** | about 841 x 701 (first generation, landscape) or about 790 x 820 dp | Not run. First generation landscape is expanded: rail 200, list 40 percent. | Same rules: rail by content width, two panes when the pane area is 600 dp or more. |
| **Android split screen, pop-up view; iPad Split View / Slide Over** | any size | Android not run. By code the app is resizable and nothing locks orientation. | Layout follows the window, never the device. Short-window rule applies to top/bottom split. |

## 4. Findings, ranked by what a person hits

### Bugs

**F1. The receipt list disappears after unfolding. (Blocker)**
Start the app on the outer screen (the normal case), open the phone: the Receipts tab shows the rail and
"Receipt details will appear here" across the whole width; the list pane has zero width. Reproduced three
times, including from a cold start (`43-coldstart-closed.png` then
`44-coldstart-closed-then-open-landscape.png`). The Search tab was not affected in the same session
(`37-open-landscape-search.png`), and rotating to portrait brings the list back.
Exact steps (iPhone Duo simulator, 4 receipts in the feed, Receipts tab):
1. Close the phone (hinge 0 degrees). Quit the app and start it again, so the first layout is on the outer
   screen (466 x 678, compact).
2. Open the phone fully (180 degrees, inner screen 951 x 669 landscape).
3. Result: rail, then the detail placeholder from x 200 to 867. No slip, no receipt rows.
4. Rotate to portrait: the list is back (234 wide). Rotate to landscape: gone again. Close: the compact
   feed is fine. Open: gone again.
The same state is reached without quitting, whenever the root layout is remounted while the window is
compact or medium (in this pass: the error panel's Retry after the Statistik crash, F3) and the window
then becomes expanded. The missing list seen on the simulator at about 14:39 on 2026-11-17 was this
state, caused by this pass's sequence. Before the first remount, closed to open showed both panes
(`07-open-landscape-addsheet.png`), which fits: the app had been started on the open screen.
Cause, as far as it could be isolated without changing code: `TwoPane` switches the list pane's style
between `{ flex: 1 }` (compact, medium) and `{ flexBasis: "40%", maxWidth: 420 }` (expanded). A pane that
was first laid out with one form does not get a correct layout when it changes to the other. Mounted in
expanded it works there and breaks in medium (407 / 61); mounted in compact or medium it works there and
breaks in expanded (0 wide). The exact React Native 0.88 mechanism is not confirmed; the fix in P1-2
removes the switch, so it holds either way.

**F2. Open portrait is three squeezed columns. (Blocker)**
At 669 pt the app is "medium": a 200 pt text rail, then list and detail share 469 pt. Freshly mounted that
is 234 / 234 and merchant names are cut. After a rotation from landscape it is 407 / 61 and the detail is
unreadable (`19-open-portrait-twopane-selected.png`). The medium class was designed for a tablet in
landscape and was never looked at on a 669 pt portrait window. Z Fold inner screens are the same class.

**F3. Statistik crashes on iOS. (Blocker, not a fold bug, found during this pass)**
"See statistics" shows "Something went wrong" in every posture (`20-open-portrait-stats.png`,
`20b-open-portrait-stats-error.png`, `46-closed-stats.png`). `src/stats/compactAmount.ts:40` calls
`Intl.NumberFormat(...).formatToParts`, which is undefined in this iOS Hermes build ("undefined is not a
function"). It happens in the hand-rolled fallback path, so iOS also lacks compact notation here. The
whole app is replaced by the error panel until Retry. Because of this, Statistik could not be checked in
any fold posture.

**F4. Closed and sideways gets the tablet layout. (Major)**
678 x 466 with an 84 pt inset is a phone in landscape, but the raw width (678) selects medium. Result:
rail plus two panes inside 594 pt, detail 63 pt wide. The rail also pads itself by the left inset
(`SideRail.tsx` `paddingStart: insets.left`) on top of the new root `SideSafeArea`, so its items are 99 pt
wide (`03-outer-landscape-10.png`). The double inset also applies to any Android phone held sideways with
a camera cutout.

**F5. Modals and sheets ignore the side strip. (Major)**
The capture/review modal and the add sheet are separate native presentations and do not sit inside
`SideSafeArea`. Closed and upright, the review form runs to x 441 of 466: the "Review later" link
(x 349 to 441) sits under the status strip (`12-closed-form-typed.png`). On the open screen the add sheet
is a full-width band, 919 pt buttons, across the fold and under the status strip
(`33-open-landscape-addsheet-fab.png`).

**F6. The add sheet closes when the phone is opened. (Major)**
Opened from the duo bar's "+" while closed, then unfolded: the sheet is gone (`06` to `07`). The sheet is
rendered inside `BottomTabs`, which is unmounted when the bar is swapped for the rail. The other direction
works (sheet opened from the Home button on the open screen survives closing, `35`), because that sheet
instance lives in the Home screen. Two instances of one sheet is the underlying problem.

### Polish

**F7. A receipt opened while closed turns into a stretched page after unfolding.**
Compact pushes `/document/[id]`. After unfold that route is still on top: one column 819 pt wide, three
buttons 235 to 313 pt wide, no list, no rail (`15-open-landscape-document-pushed.png`). The same receipt
opened on the open screen is the two-pane detail. The two also have different chrome when folded back
(native header with a "Back" pill in `14`, a text "‹ Back" in `17`).

**F8. Controls sit on the crease in tabletop and book posture.**
Listed in the matrix. The app cannot know where the fold is, so Phase 1 cannot fix this. Scrolling
content crossing the fold is acceptable; fixed controls and centred cards on the fold are not ideal.

**F9. Wasted and unpainted edges.**
Open portrait has an 82 pt band above the slip in page colour, because `greenTop` is true only for the
compact class (`21`). Closed upright has an 84 pt empty strip on the right (`05`); that one is the
platform's and stays.

**F10. The "+" changes meaning with width.**
Compact: "+" in the bar on every tab. Wide: a floating button on Home only; on Search, Folders and
Settings there is no way to add a receipt. The checklist the owner linked names this: move controls, not
their meaning.

**F11. The wide rail is text only and 200 pt wide.** It takes 21 to 30 percent of a foldable's inner
screen and has no icons, although `TAB_ICONS` exists.

**F12. Small continuity drifts.** Scroll offset on Settings moved by 82 pt (the top inset) after open
portrait to closed to open (`26`, `27`). Text focus moved from Total to Merchant when the hinge went to
90 degrees with the review form open (`10` against `11`); cause not established.

### Working, keep

- No orientation lock on either platform; the app resizes everywhere.
- One `Tabs` navigator for every size: the selected tab and each tab's screen state survive.
- `TwoPane` keeps both panes mounted; the selected receipt is a route param, so it survives fold in both
  directions.
- Typed text in the review form survives open to book to closed.
- Pushed screens (Backup, Tip jar) survive every transition and stay inside the side strip
  (`25-closed-landscape-backup.png`, `32-closed-tipjar.png`). Their 560 pt centred columns look right on
  the inner screen (`30-open-landscape-tipjar.png`).

## 5. Layout rules (the design)

One pure function decides layout from the window and the safe-area insets. Nothing branches on device
model, platform or orientation.

Inputs: window `width`, `height`; safe-area `left`, `right`. Let `content = width - left - right`.

| Decision | Rule | Duo closed | Duo closed sideways | Duo open portrait | Duo open landscape | Z Fold inner (approx.) |
|---|---|---|---|---|---|---|
| Navigation | `content < 600`: floating duo bar. `600 to 839`: icon rail, 72 wide. `>= 840`: wide rail, 200 wide | bar (382) | bar (594) | icon rail (669) | wide rail (867) | icon rail |
| Pane area | `content - rail width` | 382 | 594 | 597 | 667 | 618 to 698 |
| Two panes | pane area `>= 600` | no | no | no | yes | yes |
| List width when split | `clamp(round(pane area x 0.42), 280, 420)` | - | - | - | 280 | 280 to 293 |
| Short window | `height < 480` | no | yes (466) | no | no | only in Flex panel or split screen |

Consequences:

- **Duo open landscape:** rail 0 to 200, list 200 to 480, detail 480 to 867. The divider is 4.5 pt right
  of the fold line and inside the 40 pt fold region, so no text column lies on the crease (list text ends
  at 464, detail text starts at 504).
- **Duo open portrait:** icon rail and one 597 pt pane. This matches how iPad mini portrait behaves and
  is right for tabletop, where the fold cuts across both panes anyway.
- **Duo closed sideways:** the same layout as a phone in landscape.
- **Detail in a narrow pane:** the detail's action row (Edit, Move to folder, Delete) needs 333 pt on one
  line. The narrowest detail pane under these rules is 320, so the row must wrap (`flexWrap: "wrap"`).

Visual treatment, Ledger-slip tokens only:

- **Icon rail (72 pt):** `surface` background, hairline `border` on the trailing edge, top padding
  `insets.top + spacing.lg`. Each item is the duo bar's tab turned vertical: Ionicons 22, caption label
  10/13 weight 600 under it, `adjustsFontSizeToFit`, minimum height 56, `tonal` pill when selected,
  `surfacePressed` when pressed, icon and label `primary` when selected and `textMuted` otherwise.
- **Wide rail (200 pt):** as today, plus the same icon before the label.
- **Add button on rails:** the round `primary` "+" (the duo bar's, `theme.size.plus`) pinned at the bottom
  of the rail above `insets.bottom + spacing.lg`, on every tab. The Home floating button is removed. This
  replaces decision 5 of the redesign spec ("the existing Home FAB stays") for the reason in F10.
- **Sheets on wide windows:** when `content >= 600` the add sheet and other bottom sheets are a card
  `maxWidth` 480, centred in the content area, same radius, grab handle and buttons. Below 600 they stay
  full width but pad left and right by the safe-area insets.
- **Short window:** the slip header shows one row (this month's total and "See statistics ›") and hides
  the tax-year total, pace line, category strip and legend. Same green, same torn edge.
- **Status band:** the band above the list is slip green whenever the list is the only pane under the
  status bar (bar or single pane with a rail, no receipt open); status icons go light in that case. With
  two panes it stays page colour, as today.

## 6. Recommended changes

### Phase 1: JavaScript only. No new native dependency. No rebuild.

**P1-1. `useLayout()`** (`src/layout/layout.ts` pure function `layoutFor(...)`, `src/layout/useLayout.ts`
hook). Returns `{ nav: "bar" | "iconRail" | "wideRail", railWidth, split, listWidth, short, content }`
from the table in section 5. Unit-test the five Duo columns and 360, 599, 600, 839, 840, 1024.
Every caller of `useWindowClass()` moves to it: `(tabs)/_layout.tsx`, `TwoPane`, `ReceiptListDetail`,
`(tabs)/index.tsx`, `useTabBarSpace`, `ReceiptFormScreen` (`sideBySide`). `windowClass.ts` can stay as the
breakpoint source. Fixes F2 and F4.

**P1-2. `TwoPane` with fixed style keys** (fixes F1). Take `split` and `listWidth` from `useLayout()`.
The list pane always carries the same three keys and only their values change:
`{ flexGrow: split ? 0 : 1, flexShrink: 0, flexBasis: split ? listWidth : 0 }`. The detail pane is always
`{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }`. Never switch between the `flex` shorthand and
`flexBasis`, never use a percentage, never add or remove `maxWidth`. `display: "none"` for the hidden pane
stays. Jest cannot see this bug (it is in native layout), so the acceptance check is on the simulator:
cold start closed, open, rotate, close, open; the list is present and 280 wide every time.

**P1-3. Tabs layout, rail, add sheet** (fixes F4 double inset, F6, F10, F11).
- `(tabs)/_layout.tsx`: choose the bar by `layout.nav`; `tabBarPosition` "bottom" for bar, "left"
  otherwise.
- `SideRail`: add `variant: "icons" | "labels"`; remove `paddingStart: insets.left` (the root
  `SideSafeArea` owns the side insets; the rail must not add them again); add icons; add the "+" at the bottom.
- One add sheet: call `useAddReceipt()` once in `TabsLayout`, provide `open` and `start` through a small
  context (`AddReceiptProvider`), render `add.sheet` once next to `<Tabs>`. `BottomTabs`, `SideRail` and
  `FeedEmpty` use the context. Remove the Home floating button and `feedFabVisible`.
- `useTabBarSpace`: use `layout.nav === "bar"` instead of the compact class.

**P1-4. Modals and sheets inside the safe area** (fixes F5).
- `(modals)/_layout.tsx`: wrap the stack in a view padded by `insets.left` / `insets.right` with the page
  background. Check first that `useSafeAreaInsets()` inside the native modal reports right 84 on the
  closed Duo; if it reports 0, read the insets in the root layout and pass them down by context.
- `CaptureSheet` and `AppModal` (React Native `Modal`): read the insets in the component that renders the
  modal and pad the sheet body; apply the 480 pt centred card when `content >= 600`.
- Acceptance: closed Duo, review form: "Review later" fully left of x 382.

**P1-5. Pushed receipt becomes the selection after unfold** (fixes F7). In `src/app/document/[id].tsx`:
when `layout.split` becomes true and the screen can go back, store the id in a module-level
`pendingSelection`, call `router.back()`. `ReceiptListDetail` consumes `pendingSelection` in its focus
effect and calls `router.setParams({ selected })`. Compact keeps the native push (and the iOS back swipe).
A receipt opened by deep link with nothing beneath it stays as it is, with a 640 pt centred column.

**P1-6. Short-window slip header** (`TotalsHeader`, `short` from `useLayout()`), and **status band**
(`(tabs)/index.tsx`: `greenTop = !layout.split && !selected`).

**P1-7. Detail action row wraps** (`ReceiptDetail`): `flexWrap: "wrap"`, `rowGap: spacing.sm`.

**P1-8. Statistik crash, F3** (separate fix, same release). `currencySymbol` must not call
`formatToParts` where it does not exist: feature-test once, else derive the symbol by formatting 0 and
stripping digits, separators and spaces, else fall back to the currency code. Add a test with
`formatToParts` deleted. Then re-run the Statistik rows in section 8.

### Only if the device pass shows it: native configuration, needs a rebuild

**P1-9. Android activity restart on fold.** `MainActivity` handles
`screenSize|smallestScreenSize|screenLayout|orientation|keyboard|keyboardHidden|uiMode|locale|layoutDirection`.
`density` is not in the list. If a Z Fold reports a different density for cover and inner screens, the
activity is recreated on every fold and the open screen, typed text and scroll position are lost
(acceptance row D11 already shows that an activity recreate resets navigation). Check on a device or the
Android Studio foldable emulator first. If it restarts, add `density` to `configChanges` in the manifest
(a native change: Android dev rebuild) and confirm React Native picks up the new density.

### Phase 2: fold-aware layout. New native module. Dev rebuild on both platforms.

Do this only after someone has used a real Duo or Z Fold with Phase 1 and still finds the crease in the
way. It is the only part of this spec that adds native code.

**P2-1. Local Expo module `apps/mobile/modules/fold-info`**, next to `receipt-ocr`. One hook,
`useFold()`, returning `null` or `{ bounds: {x, y, width, height}, orientation: "vertical" | "horizontal",
separating: boolean }` in window points. iOS: the `.division` reserved region of the key window, guarded
by `#available(iOS 27.1, *)` (deployment target stays 16.4; needs Xcode 27.1 or later, the machine has
27.2). Android: `androidx.window` `WindowInfoTracker`, first `FoldingFeature`. Web and Jest: `null`.
No hinge angle, no posture enum: layout only needs the rectangle. Preferred over `expo-foldables`
because that package is very young, brings a UIScene plugin we do not need, and we need about 80 lines
per platform.

**P2-2. Divider on the fold.** In `layoutFor`, when a vertical fold lies inside the window: use the icon
rail (72) even at 840 and above, set `listWidth = fold.left - railWidth`, and start the detail pane at
`fold.right` when `separating`. Duo: list 384, detail 372. Skip if either pane would be under 280.

**P2-3. Tabletop and book layouts for two screens.** A `FoldSplit` layout component: first child on one
side of the fold, second child on the other, falling back to a normal column when `useFold()` is null or
not separating.
- Tip jar: cups and counter line above the fold, names and price buttons below (the counter sits on the
  hinge like a real counter edge). In book posture: text on the left leaf, counter on the right.
- Review form (`ReceiptFormScreen`): receipt image on one side, fields on the other. This is the product
  spec's "image left, parsed fields right", now aligned to the fold, and stacked in tabletop.
- Centred cards and sheets move wholly to one side of a separating fold.

## 7. Out of scope

- Hinge-angle effects, animations driven by the angle.
- Using the Duo's outer screen while open (camera capture accessory), direction-aware cameras. Scanning
  uses the system document scanner; nothing of ours draws a viewfinder.
- Multiple windows of the app on the inner screen (`UIApplicationSupportsMultipleScenes` stays false).
- A dedicated layout for the Z Flip cover screen. It must not break; it does not get its own design.
- Adopting native tab bars or toolbars to get Apple's vertical bars. The floating duo bar and the rail
  are the product's identity. The right-hand status strip on the closed Duo stays empty page colour.
- Android "large" and "extra-large" size classes (1200 dp and up), desktop windowing.
- Any new colour or token.

## 8. Verification list

Run after Phase 1. "Roundtrip" means: do the step, fold or rotate, check, return, check again.

### iPhone Duo simulator (Xcode 27.2), repeat the worst ones on a real Duo

1. Cold start closed; open: rail 200, list 280, detail; receipts visible. Rotate to portrait: icon rail,
   one pane. Rotate back, close, open: same as the first time. (F1, F2)
2. Cold start open landscape, then the same loop. Cold start open portrait, then the same loop.
3. Closed, turn sideways both ways: duo bar, one pane, short slip header, nothing under the camera. (F4)
4. Closed: "+" from each tab, open the phone with the sheet up: sheet still up, centred card. Close
   again: sheet still up, full width inside the strip. (F6, F5)
5. Review form with typed merchant and total: closed, book (90 degrees), open, portrait, tabletop.
   Text kept, "Review later" tappable everywhere, Save and Discard visible. Note which field has focus.
6. Closed: open a receipt, then open the phone: the receipt is selected in two-pane. Close: detail with a
   back control. (F7)
7. Backup, Tip jar, Statistik, Categories, Export, a folder, a tax year: each pushed, then closed, book,
   open landscape, open portrait, tabletop. Screen stays, nothing under the status strip.
8. Statistik with data, Bulan and Tahun pajak, all four window shapes. (F3)
9. Scroll Settings and the feed to the middle; roundtrip; note the drift (F12). Needs a longer feed than
   the 4 receipts used here.
10. Angles 60 to 100 degrees in both directions: no flash of the wrong layout at the screen switch.
11. Not covered in this pass, do on device or by hand in the simulator: Split View 50/50 and with a
    pinned video; software keyboard over the review form and Search (the simulator used the hardware
    keyboard); app lock on (the lock screen must not appear on fold or unfold); the privacy cover; the
    document scanner and photo picker returning while the phone is being folded (the simulator has no
    camera); VoiceOver order with the rail; largest Dynamic Type; dark mode; onboarding and lock screens
    in every shape.

### Galaxy Z Fold (real device or Samsung Remote Test Lab; Android Studio foldable emulator first)

1. Record the real window sizes in dp: cover, inner upright, inner sideways. Correct section 2.
2. Does folding restart the activity? Open the review form, type, fold, unfold. If text or the screen is
   lost: P1-9.
3. Items 1, 4, 5, 6, 7 of the Duo list on cover and inner screens.
4. Flex mode with and without Samsung's Flex mode panel: short-window rule, nothing unusable.
5. Split screen two and three apps, pop-up view dragged to its smallest size.
6. Hinge with gap (older Fold models): nothing important in the centre 16 dp of the inner screen.
7. `useSheetTopInset` falls back to the initial window metrics: after unfolding, the page-sheet modal's
   top padding still matches the status bar.

### Galaxy Z Flip (the rows deferred in `docs/redesign-acceptance.md`)

1. Main screen: the Redmi compact checks, plus fold and unfold with the review form open.
2. Flex mode half open, with the Flex mode panel: short slip header, list reachable, duo bar reachable.
3. Cover screen with the app enabled (Good Lock or Labs): starts, feed readable, "+" works, moving to
   the main screen keeps the open screen.

### Pixel Fold / Pixel 9 Pro Fold (Android Studio emulator is enough for layout)

1. Record window sizes; first-generation landscape is the only common foldable above 840 dp.
2. Items 1, 4, 5, 6 of the Duo list.
3. Tabletop and book posture through the emulator's hinge sensor control: nothing unusable in Phase 1.

### Regression (existing devices)

1. Redmi 14C, 360 dp, upright and sideways: unchanged in compact; sideways with a cutout no longer has a
   double-inset rail.
2. iPad or a tablet emulator at 1024 dp: wide rail with icons and "+", two panes, list 420 at most.

## 9. Sources

- https://www.orizon.co/blog/iphone-duo-app-redesign-checklist (the owner's link; seven checks: sizes
  between closed and open, controls keep their meaning, extra space earns its place, the fold as a layout
  condition, work in progress survives, difficult states, prioritise Fix / Explore / Keep)
- https://slekens.dev/en/blog/iphone-duo-xcode-27-1-six-foldable-apis/
- https://ecorpit.com/iphone-duo-sdk-new-apis-xcode-27-1-developer-guide-2026/
- https://bitrig.com/blog/iphone-duo-app-development
- https://github.com/azizbecha/expo-foldables
- https://developer.android.com/develop/ui/compose/layouts/adaptive/foldables/make-your-app-fold-aware
- https://developer.android.com/about/versions/16/behavior-changes-16 (orientation and resizability on
  large screens)
