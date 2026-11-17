# Foldable Readiness Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app correct on the iPhone Duo (closed, sideways, open landscape, open portrait, tabletop, book) and on Android foldables by deciding layout from the real content width, making pane widths deterministic, keeping sheets and modals inside the safe area, and keeping one add-receipt sheet alive across fold and unfold.

**Architecture:** One pure function `layoutFor({ width, height, left, right })` decides navigation (bar / icon rail / wide rail), split, list width and the short-window flag; `useLayout()` feeds it from `useWindowDimensions()` and the root side insets (a context published by `SideSafeArea`). Every former `useWindowClass()` caller moves to `useLayout()`. The add sheet moves into one `AddReceiptProvider` in the tabs layout, the "+" moves onto the rail on every tab, and a receipt pushed while folded pops back into the two-pane selection after unfold.

**Tech Stack:** Expo SDK 58, React Native 0.88, expo-router (js-tabs, native Stack), Reanimated 4, react-native-safe-area-context 5.11, Jest 30 + jest-expo + RNTL v14, TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-17-foldable-readiness-design.md` (authority; sections 5 and 6 "Phase 1"). Visual tokens and duo-bar rules: `docs/superpowers/specs/2026-11-16-ledger-slip-redesign-design.md`.

## Global Constraints

- JavaScript only: no new native dependency, no `app.json`/manifest/Podfile change, no dev rebuild.
- All paths below are relative to `apps/mobile/` unless they start with `docs/`. Run every command from `apps/mobile/`.
- TDD on every task: write the failing test, see it fail, implement, see it pass.
- RNTL v14: no `UNSAFE_*` queries. Find nodes by `testID`, role or text. `render`, `fireEvent` and `rerender` are awaited, as in the existing suites.
- `*.test.ts` runs in the node project (no React Native); `*.test.tsx` runs in jest-expo. A pure-logic test goes in `.ts`.
- Any `.test.tsx` suite that renders a `useLayout()` consumer without a `SafeAreaProvider` must mock `react-native-safe-area-context` (`useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })`) or mock `@/layout/useLayout`.
- Gates at the end of every task, all four must hold:
  - `npx jest --maxWorkers=50%`: all pass (baseline about 1051 tests; the count only grows, except the 1 file Task 4 deletes).
  - `npx tsc --noEmit`: clean.
  - `npm run lint`: at most 18 problems (the baseline); no new ones in touched files.
  - `npm run check:pii`: ok.
- Never run `prettier --write`. Match the surrounding formatting by hand.
- Never read `spikes/receipts/`, `spikes/ocr-dumps/` or `spikes/ocr-samples/`: they hold real personal data.
- Breakpoints (on content width = window width − left inset − right inset): `< 600` bar, `600–839` icon rail, `>= 840` wide rail. Rail widths: bar 0, icon rail 72, wide rail 200.
- Two panes when pane area (content − rail width) `>= 600`. List width when split: `clamp(round(paneArea × 0.42), 280, 420)`.
- Short window: window height `< 480`.
- Sheet card: when content `>= 600`, the add sheet is a card `maxWidth 480` centred in the content area; below 600 full width, padded by the side insets.
- Never switch the list pane between the `flex` shorthand and `flexBasis`; never a percentage width; never add or remove `maxWidth` on panes (F1).
- Tokens only (`src/theme/tokens.ts`): `spacing { xs 4, sm 8, md 12, lg 16, xl 24, xxl 32 }`, `size { touch 48, row 56, fab 60, plus 56, capsule 60 }`. No new colours. Yellow (`highlight`) only on the green slip.
- Duo bar rules stay: bar `bottom = insets.bottom + 12`, touch targets at least 48 dp, money never wraps (`numberOfLines={1}` + `adjustsFontSizeToFit`).
- Copy: reuse existing i18n keys only (`capture.add` "Add receipt", `stats.openStats` "See statistics", `tabs.*`, `common.back`). No new strings.
- Commits: Conventional Commits, one per task, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch `fix/device-findings`. Stage only the task's files (the tree has unrelated untracked `apps/web/` and docs).
- Out of scope: Phase 2 (P2-1 to P2-3, native fold module). P1-8 (Statistik `formatToParts`) is already fixed in 1af2306. **P1-9 (Android `configChanges` `density`) is deferred**: it is a native change and needs a Z Fold or the Android Studio foldable emulator to decide; the owner has no Z Fold. Do not plan or implement it.

## Rulings (decisions the spec left open, made here)

- **R1 Rail top padding.** Both rail variants keep `paddingTop: insets.top + spacing.xxl` (32), from commit 94cf1e8, not the spec's `insets.top + spacing.lg`. The commit is the newer, device-checked decision.
- **R2 Selecting a row when not split** pushes `/document/[id]` in every non-split layout (bar and icon rail), as compact does today. The `selected` param path with a back control stays only for continuity (split → not split while a row is selected).
- **R3 Side insets inside modals.** `SideSafeArea` publishes the root `{ left, right }` through a context; `useSideInsets()` reads it and falls back to `useSafeAreaInsets()` outside the provider. Modals and sheets use `useSideInsets()`, so the "does a native modal report right 84" check is not needed.
- **R4 One layout everywhere.** `split` and `listWidth` come from the window, not from the hosting screen. Pushed list screens (folder, tax year) and the review modal use the same pane rule as the tabs, although they draw no rail.
- **R5 Short slip header.** One row: the "This month" cell (flex 1) and, at the trailing end, a column with the not-converted note (only when non-zero) above "See statistics ›". The tax-year cell, pace line, strip, legend and the dashed foot row are not rendered. The button's accessibility label is unchanged.
- **R6 Modal side inset.** `AppModal` wraps the children of every non-transparent modal (all the page sheets) in `ModalSideInset`; prop `sideInset={false}` opts out and `PageViewer`'s full-screen image viewer uses it. Transparent modals (only `CaptureSheet`) lay themselves out. The 480 card applies only to `CaptureSheet`, the only bottom sheet; the others are native page sheets.
- **R7 Stats keeps its own add flow.** `StatsScreen` is pushed outside the tabs, so it keeps calling `useAddReceipt()` directly.
- **R8 FeedEmpty keeps its `onStart` prop.** Home passes `useAddReceiptContext().start`.
- **R9 `useWindowClass.ts` stays.** After Phase 1 no app code calls it (`useLockGate.test.tsx` still mocks it as a resize trigger). `windowClass.ts` stays as the breakpoint source for `layoutFor`.
- **R10 Already done in code.** P1-3 "remove `paddingStart: insets.left`" (F4 double inset) landed in 94cf1e8 and is pinned by the existing `tabsLayout.test.tsx` test. P1-7 "action row wraps" is already `flexWrap: "wrap"` with `gap: spacing.sm` in `ReceiptDetail.tsx:176`; Task 6 only adds a test that pins it.
- **R11 Icon-rail item size.** Items use `marginHorizontal: spacing.sm` (8), so each item is 56 wide in the 72 rail; label rail keeps 16.
- **R12 Review form split.** The viewer pane of `ReceiptFormScreen` takes `listWidth` (280–420) like the receipt list; the old 50/50 (medium) and 40 % (expanded) are gone.
- **R13 Pending selection** is consumed by whichever `ReceiptListDetail` gains focus next, split or not. If the person folds again before it lands, the receipt shows in the single pane with its back control, so it is never lost.
- **R14 Rail "+".** Same look as the duo bar's "+" (`theme.size.plus` 56, round, `primary` / `primaryPressed`, Ionicons `add` 26, `onPrimary`), `testID="rail-add"`, label `capture.add`, pinned at the rail bottom with `paddingBottom: insets.bottom + spacing.lg` on the rail.

## Review Focus

1. **The add sheet is open while the window changes class** (fold or unfold mid-choice): the sheet must stay open, exactly one instance. Test owned by Task 3 (`tabsLayout.test.tsx`, "one add sheet survives bar ↔ rail").
2. **The pushed receipt screen re-renders while already split** (rotation or inset change during the pop): it must call `router.back()` once, never twice (a second back would leave the tabs). Test owned by Task 6 ("goes back once even when re-rendered while split").
3. **Fractional and zero windows** (Android dp such as 599.5; a 0 × 0 first frame on some cold starts): bar, no NaN, no negative widths. Test owned by Task 1.
4. **Largest text on the icon rail** ("Pengaturan" at 1.3× in a 56 pt item): the label must shrink, never wrap or ellipsize. Test owned by Task 4 (label props `numberOfLines 1`, `adjustsFontSizeToFit`, `minimumFontScale 0.75`, `maxFontSizeMultiplier 1.3`).
5. **Left-only side inset** (Android phone sideways with the cutout on the left; Duo closed turned the other way): same layout as right-only. Test owned by Task 1 (`left 84, right 0` gives the same `Layout` as `left 0, right 84`).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/layout/layout.ts` (new) | Pure `layoutFor()` and the layout constants | 1 |
| `src/layout/useLayout.ts` (new) | Hook: window + root side insets → `Layout` | 1 |
| `src/layout/SideSafeArea.tsx` | Also publishes root side insets; `useSideInsets()` | 1 |
| `src/layout/testing/layouts.ts` (new) | Named `Layout` fixtures for test mocks | 1 |
| `src/layout/TwoPane.tsx` | Fixed-key pane styles from `useLayout()` | 2 |
| `src/receipts/ReceiptListDetail.tsx` | `split` decides push vs select | 2, 6 |
| `src/review/ReceiptFormScreen.tsx` | `sideBySide = layout.split` | 2 |
| `src/capture/AddReceiptProvider.tsx` (new) | One add flow + one sheet for the tabs | 3 |
| `src/app/(tabs)/_layout.tsx` | Provider, nav choice from `layout.nav` | 3, 4 |
| `src/layout/BottomTabBar.tsx` | Uses the context, no own sheet | 3 |
| `src/layout/SideRail.tsx` | `variant` icons/labels, icons, "+" | 4 |
| `src/layout/useTabBarSpace.ts` | `layout.nav === "bar"` | 4 |
| `src/app/(tabs)/index.tsx` | No FAB, no own sheet; status band rule | 3, 4, 7 |
| `src/receipts/feedFab.ts` + test (delete) | Obsolete | 4 |
| `src/capture/CaptureSheet.tsx` | Side insets, 480 card | 5 |
| `src/layout/ModalSideInset.tsx` (new) | Side padding for modal content | 5 |
| `src/components/AppModal.tsx` | Wraps non-transparent content | 5 |
| `src/app/(modals)/_layout.tsx` | Wraps the modal stack | 5 |
| `src/review/PageViewer.tsx` | `sideInset={false}` | 5 |
| `src/receipts/pendingSelection.ts` (new) | Hand-off of a popped document id | 6 |
| `src/app/document/[id].tsx` | Pops to the selection when split | 6 |
| `src/receipts/ReceiptDetail.tsx` | 640 centred column; testID on action row | 6 |
| `src/receipts/TotalsHeader.tsx` | Short-window form | 7 |

---

### Task 1: Layout rules (`layoutFor`, `useLayout`, root side insets)

**Files:**
- Create: `src/layout/layout.ts`, `src/layout/layout.test.ts`, `src/layout/useLayout.ts`, `src/layout/useLayout.test.tsx`, `src/layout/testing/layouts.ts`
- Modify: `src/layout/SideSafeArea.tsx`, `src/layout/sideSafeArea.test.tsx`

**Interfaces:**
- Consumes: `windowClassFor(widthDp: number): WindowClass` from `src/layout/windowClass.ts` (unchanged).
- Produces:
  ```ts
  // src/layout/layout.ts (no React Native import: it is tested in the node project)
  export type Nav = "bar" | "iconRail" | "wideRail";
  export type LayoutInput = { width: number; height: number; left: number; right: number };
  export type Layout = {
    nav: Nav;
    railWidth: number;   // 0 | 72 | 200
    content: number;     // max(0, width - left - right)
    paneArea: number;    // max(0, content - railWidth)
    split: boolean;      // paneArea >= SPLIT_MIN
    listWidth: number;   // split ? clamp(round(paneArea * LIST_SHARE), LIST_MIN, LIST_MAX) : 0
    short: boolean;      // height < SHORT_HEIGHT
  };
  export const RAIL_WIDTH: Record<Nav, number>; // { bar: 0, iconRail: 72, wideRail: 200 }
  export const SPLIT_MIN = 600, LIST_MIN = 280, LIST_MAX = 420, LIST_SHARE = 0.42,
    SHORT_HEIGHT = 480, SHEET_CARD_WIDTH = 480, SHEET_CARD_MIN_CONTENT = 600;
  export function layoutFor(input: LayoutInput): Layout;

  // src/layout/SideSafeArea.tsx
  export type SideInsets = { left: number; right: number };
  export function SideSafeArea(props: { children: ReactNode }): JSX.Element; // unchanged look, now also a provider
  export function useSideInsets(): SideInsets; // context value, else useSafeAreaInsets() left/right

  // src/layout/useLayout.ts
  export function useLayout(): Layout; // layoutFor({ width, height } from useWindowDimensions(), ...useSideInsets())

  // src/layout/testing/layouts.ts
  export const LAYOUTS: {
    phone: Layout;        // layoutFor({ width: 360, height: 800, left: 0, right: 0 })
    duoClosed: Layout;    // { width: 466, height: 678, left: 0, right: 84 }
    duoSideways: Layout;  // { width: 678, height: 466, left: 0, right: 84 }
    duoPortrait: Layout;  // { width: 669, height: 951, left: 0, right: 0 }
    duoLandscape: Layout; // { width: 951, height: 669, left: 0, right: 84 }
  };
  ```

- [ ] **Step 1: Write the failing tests**

`src/layout/layout.test.ts`:
```ts
import { layoutFor } from "./layout";

const L = (width: number, height: number, left = 0, right = 0) => layoutFor({ width, height, left, right });

describe("layoutFor: iPhone Duo postures (spec section 5)", () => {
  it.each([
    ["closed upright", L(466, 678, 0, 84), { nav: "bar", railWidth: 0, content: 382, paneArea: 382, split: false, listWidth: 0, short: false }],
    ["closed sideways", L(678, 466, 0, 84), { nav: "bar", railWidth: 0, content: 594, paneArea: 594, split: false, listWidth: 0, short: true }],
    ["open portrait", L(669, 951), { nav: "iconRail", railWidth: 72, content: 669, paneArea: 597, split: false, listWidth: 0, short: false }],
    ["open landscape", L(951, 669, 0, 84), { nav: "wideRail", railWidth: 200, content: 867, paneArea: 667, split: true, listWidth: 280, short: false }],
    ["Z Fold inner (approx.)", L(720, 840), { nav: "iconRail", railWidth: 72, content: 720, paneArea: 648, split: true, listWidth: 280, short: false }],
  ])("%s", (_name, got, want) => expect(got).toEqual(want));

  it("open landscape leaves 387 for the detail (divider at x 480)", () => {
    const l = L(951, 669, 0, 84);
    expect(l.railWidth + l.listWidth).toBe(480);
    expect(l.paneArea - l.listWidth).toBe(387);
  });
});

describe("layoutFor: breakpoints on content width", () => {
  it.each([
    [360, "bar", false, 0],
    [599, "bar", false, 0],
    [600, "iconRail", false, 0],   // pane 528
    [839, "iconRail", true, 322],  // pane 767, round(322.14)
    [840, "wideRail", true, 280],  // pane 640, round(268.8) = 269 -> 280
    [1024, "wideRail", true, 346], // pane 824, round(346.08)
    [1600, "wideRail", true, 420], // pane 1400 -> capped
  ])("width %i -> %s, split %s, list %i", (w, nav, split, list) => {
    expect(L(w, 800)).toMatchObject({ nav, split, listWidth: list });
  });

  it("narrowest split detail is 320 (pane 600 at the icon rail)", () => {
    const l = L(672, 800);
    expect(l).toMatchObject({ paneArea: 600, split: true, listWidth: 280 });
    expect(l.paneArea - l.listWidth).toBe(320);
  });

  it("short window is height < 480", () => {
    expect(L(400, 479).short).toBe(true);
    expect(L(400, 480).short).toBe(false);
  });
});

describe("layoutFor: odd inputs (Review Focus 3, 5)", () => {
  it("fractional dp just under 600 is the bar", () => expect(L(599.5, 800).nav).toBe("bar"));
  it("a 0 x 0 first frame is a bar with zero widths and no NaN", () =>
    expect(L(0, 0)).toEqual({ nav: "bar", railWidth: 0, content: 0, paneArea: 0, split: false, listWidth: 0, short: true }));
  it("insets wider than the window never give negative widths", () =>
    expect(L(100, 800, 84, 84)).toMatchObject({ content: 0, paneArea: 0 }));
  it("left-only inset equals right-only inset", () => expect(L(678, 466, 84, 0)).toEqual(L(678, 466, 0, 84)));
});
```

`src/layout/useLayout.test.tsx` (mock `react-native/Libraries/Utilities/useWindowDimensions` as `TwoPane.test.tsx` does; mock `react-native-safe-area-context` with a mutable `mockInsets`; probe renders `JSON.stringify(useLayout())` in a `Text testID="layout"`):
- `it("reads the window and the safe-area side insets (closed Duo: content 382)")`: dims 466 × 678, insets `{ top: 0, bottom: 0, left: 0, right: 84 }` → parsed probe `toEqual(layoutFor({ width: 466, height: 678, left: 0, right: 84 }))`.
- `it("inside SideSafeArea uses the root side insets")`: wrap the probe in `<SideSafeArea>` (mock `@/theme/ThemeProvider` as `sideSafeArea.test.tsx` does), dims 951 × 669, insets right 84 → `nav "wideRail"`, `listWidth 280`.

`src/layout/sideSafeArea.test.tsx`, add:
- `it("publishes the root side insets to descendants (useSideInsets)")`: probe inside `<SideSafeArea>` renders `JSON.stringify(useSideInsets())` → `{"left":12,"right":84}` with the file's existing inset mock.
- `it("useSideInsets outside SideSafeArea falls back to the safe-area insets")`: probe alone → `{"left":12,"right":84}`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/layout/layout.test.ts src/layout/useLayout.test.tsx src/layout/sideSafeArea.test.tsx --maxWorkers=50%`
Expected: FAIL, "Cannot find module './layout'" / "useSideInsets is not a function".

- [ ] **Step 3: Implement**

- `layoutFor` in `src/layout/layout.ts`: `content = Math.max(0, width - left - right)`; `nav` from `windowClassFor(content)` (compact → bar, medium → iconRail, expanded → wideRail); then the formulas in the Interfaces block. Import `windowClassFor` from `./windowClass` (no RN import).
- `SideSafeArea`: create a module-private `SideInsetsContext = createContext<SideInsets | null>(null)`; wrap the existing `View` children in its provider with `{ left: insets.left, right: insets.right }` (memoised). `useSideInsets()` returns the context value, else `{ left, right }` from `useSafeAreaInsets()` (call both hooks unconditionally).
- `useLayout()`: `useWindowDimensions()` + `useSideInsets()` → `useMemo(() => layoutFor(...), [width, height, left, right])`.
- `src/layout/testing/layouts.ts`: the five fixtures from the Interfaces block, built with `layoutFor`.

- [ ] **Step 4: Run tests to verify they pass**

Run: same command. Expected: PASS. Then run all four gates.

- [ ] **Step 5: Commit**

```bash
git add src/layout/layout.ts src/layout/layout.test.ts src/layout/useLayout.ts src/layout/useLayout.test.tsx src/layout/testing/layouts.ts src/layout/SideSafeArea.tsx src/layout/sideSafeArea.test.tsx
git commit -m "feat(layout): layoutFor decides nav, split and list width from content width"
```

---

### Task 2: Deterministic panes (TwoPane, ReceiptListDetail, review form) — fixes F1, F2, F4

**Files:**
- Modify: `src/layout/TwoPane.tsx`, `src/receipts/ReceiptListDetail.tsx`, `src/review/ReceiptFormScreen.tsx`
- Test: `src/layout/TwoPane.test.tsx`, `src/receipts/ReceiptListDetail.test.tsx`, `src/review/ReceiptFormScreen.test.tsx`, `src/organize/CollectionScreen.test.tsx`, `src/search/SearchScreen.test.tsx`

**Interfaces:**
- Consumes: `useLayout(): Layout`, `LAYOUTS` (Task 1).
- Produces: `TwoPane({ primary, secondary }: { primary: ReactNode; secondary: ReactNode | null })` (props unchanged). Pane testIDs unchanged: `pane-primary`, `pane-secondary`, `pane-placeholder`. Test mocking pattern later tasks reuse:
  ```ts
  let mockLayout = LAYOUTS.phone;
  jest.mock("@/layout/useLayout", () => ({ useLayout: () => mockLayout }));
  ```

- [ ] **Step 1: Write the failing tests**

`src/layout/TwoPane.test.tsx`: add a `react-native-safe-area-context` mock with a mutable `mockInsets` (default all 0) and a `setDims(width, height)` helper next to `setWidth`. Keep the existing tests (700 still splits: pane 628). Add:
```ts
const flatOf = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

it("open landscape (951 x 669, right 84): list pane is exactly 280 wide by flexBasis, no flex/maxWidth", async () => {
  setDims(951, 669); mockInsets.right = 84;
  await render(<TwoPane primary={primary} secondary={secondary} />);
  const s = flatOf("pane-primary");
  expect(s).toMatchObject({ flexGrow: 0, flexShrink: 0, flexBasis: 280, borderEndWidth: StyleSheet.hairlineWidth });
  expect(s.flex).toBeUndefined();
  expect(s.maxWidth).toBeUndefined();
});

it("not split: list pane carries the same keys with single-pane values", async () => {
  setDims(669, 951);
  await render(<TwoPane primary={primary} secondary={null} />);
  const single = flatOf("pane-primary");
  expect(single).toMatchObject({ flexGrow: 1, flexShrink: 0, flexBasis: 0, borderEndWidth: 0 });
  setDims(951, 669); mockInsets.right = 84;
  await render(<TwoPane primary={primary} secondary={null} />);
  expect(Object.keys(flatOf("pane-primary")).sort()).toEqual(Object.keys(single).sort());
});

it("detail pane is always { flexGrow 1, flexShrink 1, flexBasis 0, minWidth 0 }", async () => {
  for (const [w, h] of [[951, 669], [400, 800]]) {
    setDims(w, h);
    await render(<TwoPane primary={primary} secondary={secondary} />);
    expect(flatOf("pane-secondary")).toMatchObject({ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 });
  }
});

it("open portrait (669 x 951): one pane; a selection replaces the list", async () => {
  setDims(669, 951);
  await render(<TwoPane primary={primary} secondary={secondary} />);
  expect(screen.queryByTestId("pane-primary")).toBeNull();
  expect(screen.getByText("detail")).toBeTruthy();
  expect(screen.queryByTestId("pane-placeholder")).toBeNull();
});

it.each([[1024, 346], [1600, 420]])("width %i: list %i", async (w, list) => {
  setDims(w, 800);
  await render(<TwoPane primary={primary} secondary={secondary} />);
  expect(flatOf("pane-primary").flexBasis).toBe(list);
});
```
(Reset `mockInsets` in `beforeEach`. `queryByTestId` returns null for the `display: "none"` pane because of the hidden-accessibility props, as the existing compact tests rely on.)

`src/receipts/ReceiptListDetail.test.tsx`: replace the `useWindowClass` mock and `mockClass` with the `mockLayout` pattern; `"compact"` → `LAYOUTS.phone`, `"expanded"` → `LAYOUTS.duoLandscape`; rename "compact"/"expanded" in test names to "not split"/"split". Add:
- `it.each(["phone", "duoPortrait"])("not split (%s): row press pushes the document route")`: asserts `mockRouter.push` called with `{ pathname: "/document/[id]", params: { id } }` and `setParams` not called.
- `it("split -> open portrait with a selection: detail with a back control; Android back clears")`: start `duoLandscape` with `mockParams = { selected: id }`, rerender with `duoPortrait`, expect the back control (text `‹ Back` / role button name "Back", as the existing continuity test finds it), `BackHandler` press → `setParams({ selected: undefined })`.

`src/review/ReceiptFormScreen.test.tsx`: same mock swap (`"compact"` → `LAYOUTS.phone`, `"expanded"` → `LAYOUTS.duoLandscape`). Add `it("open portrait (icon rail, not split): one column with the inline viewer")`: seed with a page, `mockLayout = LAYOUTS.duoPortrait`, expect `getAllByRole("imagebutton")` length 1 and `getByLabelText("Merchant")`; the same counts as the phone case.

`src/organize/CollectionScreen.test.tsx`, `src/search/SearchScreen.test.tsx`: replace the `useWindowClass` mock with `jest.mock("@/layout/useLayout", () => ({ useLayout: () => mockLayout }))`, `mockLayout = LAYOUTS.phone`. No new tests.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/layout/TwoPane.test.tsx src/receipts/ReceiptListDetail.test.tsx src/review/ReceiptFormScreen.test.tsx --maxWorkers=50%`
Expected: FAIL (list pane still `flex: 1` / `flexBasis: "40%"`; portrait still two panes; ReceiptListDetail ignores the `useLayout` mock).

- [ ] **Step 3: Implement**

- `TwoPane`: `const { split, listWidth } = useLayout()`. `showPrimary = split || secondary == null`, `showSecondary = split || secondary != null`. Primary style is always `{ flexGrow: split ? 0 : 1, flexShrink: 0, flexBasis: split ? listWidth : 0, borderEndWidth: split ? StyleSheet.hairlineWidth : 0, borderColor: theme.colors.border }`; secondary always `{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }`; `styles.hidden` and `hiddenPane` unchanged. Placeholder only when `split && secondary == null`. Update the doc comment (split / single pane instead of window classes).
- `ReceiptListDetail`: `const { split } = useLayout()`; replace every `compact` with `!split` (back handler, `onSelect` push vs `setParams`, `onBack`). Update the doc comment.
- `ReceiptFormScreen`: `const { split } = useLayout()`; `const sideBySide = split`. Drop the `useWindowClass` import.

- [ ] **Step 4: Run tests to verify they pass**

Run: same command, then `npx jest src/organize src/search --maxWorkers=50%`. Expected: PASS. Then all four gates.

- [ ] **Step 5: Commit**

```bash
git add src/layout/TwoPane.tsx src/layout/TwoPane.test.tsx src/receipts/ReceiptListDetail.tsx src/receipts/ReceiptListDetail.test.tsx src/review/ReceiptFormScreen.tsx src/review/ReceiptFormScreen.test.tsx src/organize/CollectionScreen.test.tsx src/search/SearchScreen.test.tsx
git commit -m "fix(layout): panes keep fixed style keys; split only with 600 of pane area"
```

---

### Task 3: One add sheet for every tab — fixes F6

**Files:**
- Create: `src/capture/AddReceiptProvider.tsx`, `src/capture/AddReceiptProvider.test.tsx`
- Modify: `src/app/(tabs)/_layout.tsx`, `src/layout/BottomTabBar.tsx`, `src/app/(tabs)/index.tsx`, `src/capture/useAddReceipt.tsx` (doc comment only)
- Test: `src/layout/BottomTabBar.test.tsx`, `src/layout/tabsLayout.test.tsx`

**Interfaces:**
- Consumes: `useAddReceipt(): { open(): void; start(mode: CaptureChoice): Promise<void>; sheet: React.ReactElement }` (unchanged), `useLayout`, `LAYOUTS`.
- Produces:
  ```ts
  // src/capture/AddReceiptProvider.tsx
  export type AddReceipt = { open(): void; start(mode: CaptureChoice): Promise<void> };
  export function AddReceiptProvider(props: { children: ReactNode }): JSX.Element; // children, then the one sheet
  export function useAddReceiptContext(): AddReceipt; // throws Error("useAddReceiptContext must be used inside AddReceiptProvider")
  ```

- [ ] **Step 1: Write the failing tests**

`src/capture/AddReceiptProvider.test.tsx` (copy the mocks block from `useAddReceipt.test.tsx`: safe area, `AppModal`, `expo-router`, DB, prefs):
- `it("two consumers share one sheet: open() from either shows exactly one capture-sheet")`: two buttons each calling `useAddReceiptContext().open` → after pressing the second, `getAllByTestId("capture-sheet")` has length 1.
- `it("start('manual') runs the shared flow")`: `router.push` called with `{ pathname: "/review/[id]", params: { id: "draft-1", queue: "" } }`.
- `it("throws outside the provider")`: `expect(() => render(<Probe />)).toThrow("useAddReceiptContext must be used inside AddReceiptProvider")` (silence `console.error` with a spy).

`src/layout/tabsLayout.test.tsx`: replace the `useWindowClass` store with a `useLayout` store (`let current: Layout = LAYOUTS.phone; setLayout(l)`; same `useSyncExternalStore` trick, mock `@/layout/useLayout`). Map `"compact"` → `LAYOUTS.phone`, `"medium"` → `LAYOUTS.duoPortrait`, `"expanded"` → `LAYOUTS.duoLandscape`. Add (Review Focus 1):
```ts
it("one add sheet survives bar <-> rail (fold and unfold with the sheet up)", async () => {
  setLayout(LAYOUTS.phone);
  await renderApp("/search");
  await act(async () => fireEvent.press(within(await screen.findByTestId("tab-bar")).getByRole("button", { name: "Add receipt" })));
  expect(screen.getAllByTestId("capture-sheet")).toHaveLength(1);
  await act(async () => setLayout(LAYOUTS.duoLandscape));
  expect(screen.getByTestId("side-rail")).toBeTruthy();
  expect(screen.getAllByTestId("capture-sheet")).toHaveLength(1);
  await act(async () => setLayout(LAYOUTS.phone));
  expect(screen.getAllByTestId("capture-sheet")).toHaveLength(1);
});
```

`src/layout/BottomTabBar.test.tsx`: render `BottomTabs` inside `<AddReceiptProvider>` (add a `render` helper). Add `it("pressing + opens the provider's sheet; the bar renders no sheet of its own")`: before press `queryByTestId("capture-sheet")` null; after pressing "Tambah struk" exactly one.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/capture/AddReceiptProvider.test.tsx src/layout/tabsLayout.test.tsx src/layout/BottomTabBar.test.tsx --maxWorkers=50%`
Expected: FAIL ("Cannot find module './AddReceiptProvider'"; the sheet disappears when the bar unmounts).

- [ ] **Step 3: Implement**

- `AddReceiptProvider`: call `useAddReceipt()` once; provide `{ open, start }` (memoise the value on `add.open`/`add.start` identity is not stable, so a plain object is acceptable; do not add `useCallback` churn to `useAddReceipt`); render `{children}{add.sheet}`.
- `(tabs)/_layout.tsx`: wrap `<Tabs>` in `<AddReceiptProvider>`. In this task also switch the bar choice to `useLayout()`: `const bar = useLayout().nav === "bar"`; `tabBar` = `bar ? <BottomTabs/> : <SideRail/>`; `tabBarPosition: bar ? "bottom" : "left"`.
- `BottomTabs`: `const add = useAddReceiptContext()`; delete `{add.sheet}`.
- `index.tsx`: replace `useAddReceipt()` with `useAddReceiptContext()`; `FeedEmpty onStart={(m) => void add.start(m)}` unchanged; delete `{add.sheet}`. The FAB stays until Task 4 and calls `add.open`.
- `useAddReceipt.tsx`: doc comment: "The tabs share one instance through `AddReceiptProvider`; pushed screens such as Statistik call it directly." (R7)

- [ ] **Step 4: Run tests to verify they pass**

Run: same command. Expected: PASS. Then all four gates.

- [ ] **Step 5: Commit**

```bash
git add src/capture/AddReceiptProvider.tsx src/capture/AddReceiptProvider.test.tsx src/capture/useAddReceipt.tsx "src/app/(tabs)/_layout.tsx" "src/app/(tabs)/index.tsx" src/layout/BottomTabBar.tsx src/layout/BottomTabBar.test.tsx src/layout/tabsLayout.test.tsx
git commit -m "fix(capture): one add sheet for all tabs survives fold and unfold"
```

---

### Task 4: Icon rail, wide rail with icons, "+" on the rail — fixes F10, F11

**Files:**
- Modify: `src/layout/SideRail.tsx`, `src/app/(tabs)/_layout.tsx`, `src/layout/useTabBarSpace.ts`, `src/app/(tabs)/index.tsx`
- Create: `src/layout/SideRail.test.tsx`
- Delete: `src/receipts/feedFab.ts`, `src/receipts/feedFab.test.ts`
- Test: `src/layout/tabsLayout.test.tsx`, `src/layout/BottomTabBar.test.tsx`

**Interfaces:**
- Consumes: `useLayout`, `LAYOUTS`, `useAddReceiptContext(): AddReceipt` (Task 3), `TAB_ICONS`, `TAB_LABEL_KEYS` (`src/layout/tabs.ts`).
- Produces:
  ```ts
  export type RailVariant = "icons" | "labels";
  export function SideRail(props: BottomTabBarProps & { variant: RailVariant }): JSX.Element;
  // testIDs: "side-rail" (container), "rail-add" (the +)
  ```

- [ ] **Step 1: Write the failing tests**

`src/layout/SideRail.test.tsx` (mocks: safe area `{ top: 0, bottom: 34, left: 0, right: 0 }`, DB and prefs as in `BottomTabBar.test.tsx`; render inside `AddReceiptProvider`; `initI18n("id")`; reuse the `props()` and `flat()` helpers from `BottomTabBar.test.tsx`):
```ts
it.each([["icons", 72], ["labels", 200]])("%s rail is %i wide, hairline end border, top padding 32", async (variant, width) => {
  await render(<SideRail {...props()} variant={variant as RailVariant} />);
  expect(flat(screen.getByTestId("side-rail"))).toMatchObject({ width, borderEndWidth: StyleSheet.hairlineWidth, paddingTop: 32, paddingBottom: 34 + 16 });
});

it("icons: each tab is icon over a caption label, 56 high, 8 side margin, a11y name = label", async () => {
  await render(<SideRail {...props(0)} variant="icons" />);
  const tabs = screen.getAllByRole("tab");
  expect(tabs.map((t) => t.props.accessibilityLabel)).toEqual(["Struk", "Cari", "Folder", "Pengaturan"]);
  expect(flat(tabs[0])).toMatchObject({ minHeight: 56, marginHorizontal: 8, backgroundColor: light.colors.tonal });
  const icon = tabs[0].children[0] as { props: Record<string, unknown> };
  expect(icon.props).toMatchObject({ size: 22, color: light.colors.primary, accessible: false });
  expect((tabs[1].children[0] as { props: Record<string, unknown> }).props.color).toBe(light.colors.textMuted);
});

it("icons: labels shrink, never wrap (Pengaturan at 1.3x)", async () => {
  await render(<SideRail {...props()} variant="icons" />);
  expect(screen.getByText("Pengaturan").props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.75, maxFontSizeMultiplier: 1.3 });
  expect(flat(screen.getByText("Pengaturan"))).toMatchObject({ fontSize: 10, lineHeight: 13, fontWeight: "600" });
});

it("labels: icon before the label, 16 side margin kept", async () => {
  await render(<SideRail {...props()} variant="labels" />);
  const tab = screen.getAllByRole("tab")[0];
  expect(flat(tab)).toMatchObject({ marginHorizontal: 16, flexDirection: "row" });
  expect((tab.children[0] as { props: Record<string, unknown> }).props.size).toBe(22);
});

it.each(["icons", "labels"])("%s: round + (56) labelled Tambah struk opens the add sheet", async (variant) => {
  await render(<SideRail {...props()} variant={variant as RailVariant} />);
  const add = screen.getByTestId("rail-add");
  expect(add.props.accessibilityLabel).toBe("Tambah struk");
  expect(flat(add)).toMatchObject({ width: 56, height: 56, borderRadius: 28, backgroundColor: light.colors.primary });
  await fireEvent.press(add);
  expect(screen.getByTestId("capture-sheet")).toBeTruthy();
});
```

`src/layout/tabsLayout.test.tsx`, change and add:
- Existing "%s: side rail" test: rename to `it.each([["duoPortrait", 72], ["duoLandscape", 200]])("%s: side rail %i wide, no tab bar, 4 labels")` and assert the width.
- `it.each(["/", "/search", "/folders", "/settings"])("rail + opens the add sheet on %s", ...)` with `LAYOUTS.duoLandscape`: press `rail-add` → `capture-sheet` present.
- `it("wide layouts: exactly one Add receipt button (no Home FAB)")`: `LAYOUTS.duoLandscape`, route `/` → `getAllByRole("button", { name: "Add receipt" })` has length 1 and it is `rail-add`.
- The existing breathing-room test stays as is (labels variant: `paddingTop 32`, no `paddingStart`, `marginHorizontal 16`).

`src/layout/BottomTabBar.test.tsx` `useTabBarSpace` block: replace the `useWindowClass` mock with the `mockLayout` pattern; "is 0 on wide layouts" sets `mockLayout = LAYOUTS.duoPortrait` (icon rail, not split: still 0). Add `it("closed Duo sideways (bar, 594 content) still clears the bar")` with `LAYOUTS.duoSideways` → `47 + 12 + capsule + 24`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/layout --maxWorkers=50%`
Expected: FAIL (no `variant`, no icons, no `rail-add`; the Home FAB makes two "Add receipt" buttons).

- [ ] **Step 3: Implement**

- `SideRail`: width `variant === "icons" ? 72 : 200` (use `RAIL_WIDTH` from `layout.ts`); container `paddingTop: insets.top + theme.spacing.xxl`, `paddingBottom: insets.bottom + theme.spacing.lg`, `gap: spacing.sm`, `surface` background, hairline `border` end edge (R1, R14). Tabs as today plus `accessibilityLabel={label}`. Icons item: `alignItems: "center"`, `justifyContent: "center"`, `minHeight: 56`, `gap: 2`, `paddingHorizontal: spacing.xs`, `paddingVertical: spacing.sm`, `marginHorizontal: spacing.sm`, `borderRadius: radius.pill`; Ionicons 22 (`accessible={false}`, `importantForAccessibility="no"`) over a caption `Text` with the `BottomTabs` label props and style (10/13/600); colour `primary` when focused, else `textMuted`; `tonal` / `surfacePressed` backgrounds as today. Labels item: today's item plus `flexDirection: "row"`, `alignItems: "center"`, `gap: spacing.md`, the icon before the label (icon colour as above, label unchanged). Below the tabs a `View style={{ flex: 1 }}` spacer, then the "+" `Pressable` (`testID="rail-add"`, `alignSelf: "center"`, look of the `BottomTabs` "+") calling `useAddReceiptContext().open`.
- `(tabs)/_layout.tsx`: `const { nav } = useLayout()`; `nav === "bar" ? <BottomTabs/> : <SideRail {...props} variant={nav === "iconRail" ? "icons" : "labels"} />`.
- `useTabBarSpace`: `useLayout().nav === "bar"` replaces the compact check; update the doc comment.
- `index.tsx`: delete the FAB `Pressable`, its `styles`, `feedFabVisible` import and the `add.open` use; keep `add.start` for `FeedEmpty`. Update the doc comment of `useAddReceipt.tsx` if it still mentions the Home FAB.
- Delete `src/receipts/feedFab.ts` and `src/receipts/feedFab.test.ts` (`git rm`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/layout src/receipts --maxWorkers=50%`. Expected: PASS. Then all four gates (jest count drops by the 1 deleted feedFab test and rises by the new ones).

- [ ] **Step 5: Commit**

```bash
git add src/layout/SideRail.tsx src/layout/SideRail.test.tsx "src/app/(tabs)/_layout.tsx" "src/app/(tabs)/index.tsx" src/layout/useTabBarSpace.ts src/layout/tabsLayout.test.tsx src/layout/BottomTabBar.test.tsx src/capture/useAddReceipt.tsx
git rm src/receipts/feedFab.ts src/receipts/feedFab.test.ts
git commit -m "feat(layout): icon rail and + on the rail for every tab; Home FAB removed"
```

---

### Task 5: Sheets and modals inside the safe area — fixes F5

**Files:**
- Create: `src/layout/ModalSideInset.tsx`, `src/layout/modalSideInset.test.tsx`
- Modify: `src/capture/CaptureSheet.tsx`, `src/components/AppModal.tsx`, `src/app/(modals)/_layout.tsx`, `src/review/PageViewer.tsx`
- Test: `src/capture/CaptureSheet.test.tsx`, `src/components/AppModal.test.tsx`

**Interfaces:**
- Consumes: `useSideInsets(): SideInsets`, `useLayout()`, `SHEET_CARD_WIDTH`, `SHEET_CARD_MIN_CONTENT` (Task 1).
- Produces:
  ```ts
  export function ModalSideInset(props: { children: ReactNode }): JSX.Element; // testID "modal-side-inset"
  // AppModal gains: sideInset?: boolean  (default: !transparent)
  export function AppModal(props: ModalProps & { sideInset?: boolean }): JSX.Element;
  // CaptureSheet testIDs: "capture-sheet-frame" (inset wrapper), "capture-sheet" (the card)
  ```

- [ ] **Step 1: Write the failing tests**

`src/layout/modalSideInset.test.tsx` (mocks as in `sideSafeArea.test.tsx`, insets right 84):
- `it("pads modal content by the root side insets with the page background")`: flattened style `toMatchObject({ flex: 1, paddingLeft: 12, paddingRight: 84, backgroundColor: "#F2F5F1" })`, `paddingTop` undefined.
- `it("wraps the (modals) stack")`: `readFileSync` of `src/app/(modals)/_layout.tsx` matches `/<ModalSideInset>\s*<Stack /`.

`src/components/AppModal.test.tsx`, add (mock safe area with right 84):
- `it("a page-sheet modal's content sits inside modal-side-inset")`: `<AppModal visible presentationStyle="pageSheet"><Text>x</Text></AppModal>` → `within(getByTestId("modal-side-inset")).getByText("x")`.
- `it("transparent modals and sideInset={false} are not wrapped")`: both cases → `queryByTestId("modal-side-inset")` null, text still rendered.

`src/capture/CaptureSheet.test.tsx`: mock `react-native/Libraries/Utilities/useWindowDimensions` (as `TwoPane.test.tsx`) and keep its `SafeAreaProvider`, giving `initialMetrics` insets per case. Add:
```ts
it("closed Duo (466 wide, right 84): full-width sheet kept out of the status strip", async () => {
  // dims 466 x 678, insets { top: 0, bottom: 0, left: 0, right: 84 }
  expect(flat("capture-sheet-frame")).toMatchObject({ paddingLeft: 0, paddingRight: 84 });
  expect(flat("capture-sheet")).toMatchObject({ width: "100%", maxWidth: "100%", alignSelf: "center" });
});
it("open landscape (951 wide, right 84): a centred 480 card", async () => {
  expect(flat("capture-sheet-frame")).toMatchObject({ paddingRight: 84 });
  expect(flat("capture-sheet")).toMatchObject({ width: "100%", maxWidth: 480, alignSelf: "center", borderTopLeftRadius: tokens.light.radius.sheet });
});
it("599 content stays full width; 600 becomes the card", ...); // dims 599 x 800 -> maxWidth "100%"; 600 x 800 -> 480
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/layout/modalSideInset.test.tsx src/components/AppModal.test.tsx src/capture/CaptureSheet.test.tsx --maxWorkers=50%`
Expected: FAIL ("Cannot find module './ModalSideInset'"; no `capture-sheet-frame`).

- [ ] **Step 3: Implement**

- `ModalSideInset`: like `SideSafeArea`'s `View` but reads `useSideInsets()` (R3); `flex: 1`, page `background`.
- `AppModal`: destructure `sideInset = !rest.transparent`; when true render `<Modal ...><ModalSideInset>{children}</ModalSideInset></Modal>`, else as today. The obscured logic is unchanged.
- `(modals)/_layout.tsx`: `<ModalSideInset><Stack screenOptions={{ headerShown: false }} /></ModalSideInset>`.
- `PageViewer`: pass `sideInset={false}` to its full-screen `AppModal` (R6).
- `CaptureSheet`: keep the backdrop full width. Wrap the card in `View testID="capture-sheet-frame"` with `paddingLeft/Right` from `useSideInsets()`. Card style gains `width: "100%"`, `alignSelf: "center"`, `maxWidth: layout.content >= SHEET_CARD_MIN_CONTENT ? SHEET_CARD_WIDTH : "100%"` (the key is always present). Everything else (radius, handle, buttons, `paddingBottom: insets.bottom + spacing.lg`) unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: same command, then `npx jest src/components src/capture src/review --maxWorkers=50%` (the `appModalGuard` and every `AppModal` user). Expected: PASS. Then all four gates.

- [ ] **Step 5: Commit**

```bash
git add src/layout/ModalSideInset.tsx src/layout/modalSideInset.test.tsx src/components/AppModal.tsx src/components/AppModal.test.tsx "src/app/(modals)/_layout.tsx" src/review/PageViewer.tsx src/capture/CaptureSheet.tsx src/capture/CaptureSheet.test.tsx
git commit -m "fix(layout): sheets and modals stay out of the side strips; 480 card on wide windows"
```

---

### Task 6: A pushed receipt becomes the selection after unfold — fixes F7; pins P1-7

**Files:**
- Create: `src/receipts/pendingSelection.ts`, `src/receipts/pendingSelection.test.tsx`
- Modify: `src/app/document/[id].tsx`, `src/receipts/ReceiptListDetail.tsx`, `src/receipts/ReceiptDetail.tsx`
- Test: `src/receipts/ReceiptListDetail.test.tsx`, `src/receipts/ReceiptDetail.test.tsx`

**Interfaces:**
- Consumes: `useLayout()` (Task 1), `router` from `expo-router` (`canGoBack()`, `back()`, `setParams()`).
- Produces:
  ```ts
  // src/receipts/pendingSelection.ts (module-level single slot)
  export function setPendingSelection(id: string): void;
  export function takePendingSelection(): string | null; // returns the id and clears it
  export function usePopToSelection(id: string, split: boolean): void;
  // When split && router.canGoBack(): setPendingSelection(id) then router.back(), at most once per mount (ref guard).
  // ReceiptDetail action row gains testID "receipt-detail-actions".
  ```

- [ ] **Step 1: Write the failing tests**

`src/receipts/pendingSelection.test.tsx` (mock `expo-router` with `mockRouter = { back: jest.fn(), canGoBack: jest.fn(() => true) }`; use RNTL `renderHook`; clear the slot with `takePendingSelection()` in `beforeEach`):
```ts
it("take returns the id once, then null", () => {
  setPendingSelection("r1");
  expect(takePendingSelection()).toBe("r1");
  expect(takePendingSelection()).toBeNull();
});
it("not split: the pushed receipt stays (compact keeps the native push)", async () => {
  await renderHook(() => usePopToSelection("r1", false));
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(takePendingSelection()).toBeNull();
});
it("split with history: hands the id over and goes back", async () => {
  await renderHook(() => usePopToSelection("r1", true));
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(takePendingSelection()).toBe("r1");
});
it("unfold after opening: goes back when split turns true", async () => {
  const h = await renderHook(({ split }) => usePopToSelection("r1", split), { initialProps: { split: false } });
  await h.rerender({ split: true });
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});
it("goes back once even when re-rendered while split (Review Focus 2)", async () => {
  const h = await renderHook(({ split }) => usePopToSelection("r1", split), { initialProps: { split: true } });
  await h.rerender({ split: true });
  await h.rerender({ split: true });
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});
it("deep link with nothing beneath: stays", async () => {
  mockRouter.canGoBack.mockReturnValueOnce(false);
  await renderHook(() => usePopToSelection("r1", true));
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(takePendingSelection()).toBeNull();
});
```

`src/receipts/ReceiptListDetail.test.tsx`, add:
- `it("a pending selection from a popped document becomes `selected` on focus, once")`: `setPendingSelection(id)`, render with `LAYOUTS.duoLandscape` → `mockRouter.setParams` called with `{ selected: id }`; `takePendingSelection()` now null.
- `it("unfocused screens leave the pending selection alone")`: `mockFocused = false` → `setParams` not called; `takePendingSelection()` still returns the id.

`src/receipts/ReceiptDetail.test.tsx`, add:
- `it("content is a centred column at most 640 wide (deep-linked on a wide screen)")`: flatten `getByTestId("receipt-detail-scroll").props.contentContainerStyle` → `toMatchObject({ width: "100%", maxWidth: 640, alignSelf: "center" })`.
- `it("action row wraps in a narrow detail pane (320)")`: flatten `getByTestId("receipt-detail-actions").props.style` → `toMatchObject({ flexDirection: "row", flexWrap: "wrap", gap: 8 })`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/receipts --maxWorkers=50%`
Expected: FAIL ("Cannot find module './pendingSelection'"; no `maxWidth`; no `receipt-detail-actions`).

- [ ] **Step 3: Implement**

- `pendingSelection.ts`: a module `let pending: string | null`. `usePopToSelection`: a `useRef(false)` guard and a `useEffect` on `[id, split]`.
- `document/[id].tsx`: `usePopToSelection(id, useLayout().split)`. Update the doc comment: "Receipt detail when not split; after an unfold it hands the receipt to the list's selection and pops."
- `ReceiptListDetail`: in a second `useFocusEffect(useCallback(() => { const id = takePendingSelection(); if (id) router.setParams({ selected: id }); }, []))` (R13).
- `ReceiptDetail`: add `width: "100%", maxWidth: 640, alignSelf: "center"` to the `ScrollView` `contentContainerStyle`; add `testID="receipt-detail-actions"` to the action row `View` (style unchanged, R10).

- [ ] **Step 4: Run tests to verify they pass**

Run: same command. Expected: PASS. Then all four gates.

- [ ] **Step 5: Commit**

```bash
git add src/receipts/pendingSelection.ts src/receipts/pendingSelection.test.tsx "src/app/document/[id].tsx" src/receipts/ReceiptListDetail.tsx src/receipts/ReceiptListDetail.test.tsx src/receipts/ReceiptDetail.tsx src/receipts/ReceiptDetail.test.tsx
git commit -m "fix(receipts): a receipt opened while folded becomes the selection after unfold"
```

---

### Task 7: Short-window slip header and the green status band — fixes F9 and the short-window rows

**Files:**
- Modify: `src/receipts/TotalsHeader.tsx`, `src/app/(tabs)/index.tsx`
- Test: `src/receipts/TotalsHeader.test.tsx`, `src/layout/tabsLayout.test.tsx`

**Interfaces:**
- Consumes: `useLayout()` (`short`, `split`), `LAYOUTS` (Task 1).
- Produces: `TotalsHeader()` (no props, unchanged signature). New testID `slip-short-stats` on the trailing column of the short row. Existing testIDs keep their meaning.

- [ ] **Step 1: Write the failing tests**

`src/receipts/TotalsHeader.test.tsx`: add the `mockLayout` pattern (`mockLayout = LAYOUTS.phone` in `beforeEach`). Add a `describe("TotalsHeader short window (height < 480)")` using the file's existing seed helpers so the full slip would show pace, strip and legend:
- `it("one row: this month and See statistics; no tax year, pace, strip, legend or foot row")`: `mockLayout = LAYOUTS.duoSideways` → `getByTestId("slip-cell-month")`, `getByTestId("slip-amount-month")` with `numberOfLines 1` and `adjustsFontSizeToFit`, `within(getByTestId("slip-short-stats")).getByText("Lihat statistik ›")` (the suite's language; use the en text if the suite is en), and `queryByTestId` null for `slip-cell-year`, `slip-pace`, `slip-strip-seg-0`, `slip-legend`.
- `it("short window keeps the not-converted note visible")`: seed one unconverted receipt → the note text is inside `slip-short-stats`.
- `it("short window keeps the full accessibility label")`: the `totals-slip` `accessibilityLabel` equals the one rendered with `LAYOUTS.phone` for the same data.
- `it("height 480 is the full slip")`: `mockLayout = layoutFor({ width: 360, height: 480, left: 0, right: 0 })` → `slip-cell-year` present, `slip-short-stats` absent.

`src/layout/tabsLayout.test.tsx`, add:
- `it("open portrait (icon rail, one pane): light status icons over the green band")`: `setLayout(LAYOUTS.duoPortrait)`, route `/` → `setStatusBarStyle` last called with `"light"`; and `StyleSheet.flatten(getAllByTestId("status-bar-inset")[0].props.style).backgroundColor` is `tokens.light.colors.slip`.
- Keep "Receipts on wide layouts keeps the themed icons" with `LAYOUTS.duoLandscape` (split).
- `it("open portrait with a receipt open keeps the themed icons")`: `LAYOUTS.duoPortrait`, route `/?selected=r1` → never `"light"`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/receipts/TotalsHeader.test.tsx src/layout/tabsLayout.test.tsx --maxWorkers=50%`
Expected: FAIL (full slip in a short window; portrait band in page colour).

- [ ] **Step 3: Implement**

- `TotalsHeader`: `const { short } = useLayout()`. When `short` (R5): the top row renders `cell("month", ..., true)` and a trailing `View testID="slip-short-stats"` (`alignItems: "flex-end"`, `justifyContent: "flex-end"`, `flexShrink: 1`) holding the not-converted note (only when `stats.unconverted > 0`, `type.body`, `slipText`) above the existing "See statistics ›" `Text` (`highlight`, `FONTS.bold`). Skip the year cell, pace, strip, legend and the dashed foot row. Padding, green, `SlipEdge`, press and `accessibilityLabel` unchanged. The full branch is unchanged.
- `index.tsx`: `const { split } = useLayout()`; `const greenTop = !split && !selected`; drop the `useWindowClass` import; update the comment above `greenTop` (bar or a single pane beside a rail, no receipt open).

- [ ] **Step 4: Run tests to verify they pass**

Run: same command. Expected: PASS. Then all four gates, plus `grep -rn "useWindowClass" src --include="*.tsx" --include="*.ts" | grep -v test` prints only `src/layout/useWindowClass.ts` (R9).

- [ ] **Step 5: Commit**

```bash
git add src/receipts/TotalsHeader.tsx src/receipts/TotalsHeader.test.tsx "src/app/(tabs)/index.tsx" src/layout/tabsLayout.test.tsx
git commit -m "feat(slip): short-window slip header; green status band beside the icon rail"
```

---

### Task 8: Device verification on iPhone Duo simulator (controller only, not a subagent)

Run by the controller on the iPhone Duo simulator (Xcode 27.2) with Metro serving this branch (JS only: reload, no rebuild). Seed at least 12 receipts so the feed scrolls, one draft, one unconverted receipt. Record a screenshot per item in the session scratchpad and note pass/fail with measured frames (Accessibility Inspector or the element inspector). Any fail: fix with a new TDD task before finishing the branch.

- [ ] **D1 Closed, upright (466 × 678):** duo bar, one pane, full slip; nothing under the right status strip; bar bottom = inset + 12.
- [ ] **D2 Closed, sideways both ways (678 × 466):** duo bar, one pane, short slip header (one row, "See statistics ›"), no rail, nothing under the camera side (F4).
- [ ] **D3 Open landscape (951 × 669):** wide rail 200 with icons and "+" at the bottom; list 200–480 (280 wide); detail 480–867; placeholder when nothing selected; "Add receipt" on all four tabs; no Home FAB (F10, F11).
- [ ] **D4 Open portrait (669 × 951):** icon rail 72, one pane 597; band above the slip is slip green with light status icons; tap a receipt → document pushed; back returns to the list (F2, F9).
- [ ] **D5 Tabletop (inner portrait, about 90°):** same as D4; every control usable; note which fixed controls sit on the fold (y 455–495) for Phase 2.
- [ ] **D6 Book (inner landscape, about 90°):** same as D3; divider at x 480, inside the 40 pt fold region.
- [ ] **D7 Cold start closed, then open (F1):** quit, start closed, open fully → rail, list 280 with receipts, detail. Rotate to portrait → icon rail, one pane. Rotate back, close, open → list still 280. Repeat from cold start open landscape and from cold start open portrait.
- [ ] **D8 Add sheet across a fold (F6, F5):** closed, "+" from each tab, open the phone with the sheet up → still up, one sheet, 480 centred card; close again → still up, full width, left of x 382. Choose "Add manually" after the roundtrip: the review form opens once.
- [ ] **D9 Review form (F5):** closed, typed merchant and total → "Review later" fully left of x 382; then book, open, portrait, tabletop: text kept, Save and Discard visible; note which field has focus (F12, not fixed in Phase 1).
- [ ] **D10 Pushed receipt across an unfold (F7):** closed, open a receipt from Receipts, then from Search, then from a folder; open the phone → the same receipt selected in two-pane on that screen; close → detail with the back control; open a receipt by deep link on the open screen → stays, centred 640 column.
- [ ] **D11 Pushed screens:** Backup, Tip jar, Statistik, Categories, Export, a folder, a tax year in closed, book, open landscape, open portrait, tabletop: screen stays, nothing under the status strip; page sheets (filter, folder form, category form, currency picker) inside the strip.
- [ ] **D12 Hinge 60–100° both directions:** no flash of a wrong layout at the screen switch.
- [ ] **D13 Redmi 14C regression (360 dp, Android device):** compact layout unchanged upright (duo bar, Home slip, + sheet full width, document push); sideways with a cutout: no double-inset rail, short slip when the height is under 480.

Phase 2 and P1-9 stay out: record D5/D6 crease notes and any Android fold restart reports for the Phase 2 / P1-9 decision.
