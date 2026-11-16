# Ledger Slip Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the owner-approved "Ledger slip" look (tokens, type, shared Button/Card, slip header with torn edge, floating duo tab bar) and Home stats (slip stats line, Statistik screen, unconverted filter) without moving existing layouts.

**Architecture:** New colour/elevation/font tokens flow through `useTheme()`; two shared components (`Button`, `Card`) replace hand-styled `Pressable`s per the Fable call-site map. The tabs layout swaps its bottom bar for an absolutely positioned floating capsule plus a + button driven by a shared `useAddReceipt()` hook. Stats come from three new grouped queries plus a pure `src/stats/` module, rendered on the slip and a new pushed `/stats` route.

**Tech Stack:** Expo SDK 58, React Native 0.88 (New Architecture, `boxShadow` style), Expo Router (`expo-router/js-tabs`), TypeScript strict, Drizzle + SQLCipher, react-i18next (en, id, es, pt-BR), Jest (jest-expo + node projects, `@testing-library/react-native` v14 async render). New JS-only packages: `@expo-google-fonts/bricolage-grotesque`, `@expo/vector-icons`.

**Spec:** `docs/superpowers/specs/2026-11-16-ledger-slip-redesign-design.md` (authority). Companions: `docs/superpowers/specs/2026-11-16-ui-polish.md` (component APIs, call-site map, defect fixes; its colours/elevation/button looks are overridden), `docs/superpowers/specs/2026-11-16-home-stats-design.md`. Approved mockups: `docs/design/2026-11-16-ledger-slip-mockup.html`, `docs/design/2026-11-16-stats-mockup.html` (open in a browser; they are the visual reference for every value not written here).

## Global Constraints

- No layout moves beyond: slip grows, tab bar floats, tab targets reach 48 dp, Fable section 6 deltas. No copy changes except new stats/filter strings.
- No new native dependencies; no blur/glass (`expo-blur`, `expo-glass-effect` forbidden). Only the two JS packages above, installed with `npx expo install`.
- Every text/background pair ≥ 4.5:1 in light and dark, enforced in `src/theme/contrast.test.ts`.
- Touch targets ≥ 48 dp; `minHeight`, never fixed `height`, on anything holding text (except the round + and FAB).
- Money never wraps mid-number, never ellipsizes and never scrolls (no marquee); money uses `fontVariant: ["tabular-nums"]`. Long amounts: shrink to fit (floor 0.6), then the compact form (`compactAmount`) with the exact amount kept in the accessibility label and shown in full on Statistik and the receipt detail (owner question, 2026-11-16). In list rows the amount never shrinks; the merchant name truncates instead.
- Nothing calls the network; fonts and icons are bundled.
- Floating bar bottom = system bottom inset + 12 dp, in gesture (16 dp inset) and 3-button (47 dp inset) navigation.
- Out of scope (v1.1, `docs/m5-followups.md`): bulk exchange-rate screen.
- Gates after every task: `npx jest` green, `npx tsc --noEmit` clean, `npx expo lint` no new errors (baseline 18 problems: 4 errors, 14 warnings), `npm run check:pii` ok. Commands run in `apps/mobile`.
- Owner check-in after Tasks 2, 5, 7, 10 and 11 (the five spec checkpoints): stop, report with Redmi screenshots where the task touches visuals, wait for "go".

## Review Focus

1. **Short previous month**: today 2026-03-31 compares against Feb 1–28, not "Feb 31"; today 2024-03-30 against Feb 1–29. Test in Task 8.
2. **Nothing converted / zero last month**: pace percent is `null` (line hidden), strip hidden when converted total is 0; no division by zero. Test in Task 8.
3. **Zero-decimal and huge currencies**: JPY (exponent 0) and IDR totals ≥ 10^12 format compactly and fit; compact formatter falls back when `Intl` compact notation is missing (Hermes). Test in Task 8.
4. **Large font (fontScale 2.0)**: tab labels cap at `maxFontSizeMultiplier={1.3}` so "Pengaturan" stays inside its pill; slip totals still shrink to one line. Tests in Tasks 6 and 7.
5. **Tax year not starting in January** (start month 4): Statistik "Tahun pajak" bars run Apr..Mar and the pace compares to the same date of the previous tax year. Test in Task 8.

---

## Checkpoint 1: foundation

### Task 1: Ledger tokens, elevation, fonts, contrast

**Files:**
- Modify: `src/theme/tokens.ts`, `src/theme/contrast.test.ts`, `src/app/_layout.tsx`, `package.json`
- Create: `src/theme/fonts.ts`
- Test: `src/theme/contrast.test.ts`, `src/theme/tokens.test.ts`

**Interfaces:**
- Produces: `ColorTokens` gains `primaryPressed, tonal, tonalPressed, tonalDanger, surfacePressed, brassFill, brassRing, slip, slipText, slipMuted, bar` (values: spec "Tokens" table and call 4: `surfacePressed` #E9EEEA / #1F2A26). Existing keys take the spec's new values; `warning` = brass text. `Theme` gains `elevation: { raised: string; sheet: string }` (spec strings), `state: { disabledOpacity: 0.4; pressedOpacity: 0.6 }`, `size: { touch: 48; row: 56; fab: 60; plus: 56; capsule: 60 }`, `radius` gains `control: 14`, `sheet: 26`. `type` gains `display: { fontFamily: FONTS.extraBold; fontSize: 28; lineHeight: 34 }`, `title` gets `fontFamily: FONTS.bold`, `label: { fontSize: 16; lineHeight: 22; fontWeight: "600" }`, `money: { fontVariant: ["tabular-nums"] }`.
- Produces: `src/theme/fonts.ts`: `export const FONTS = { bold: "BricolageGrotesque_700Bold", extraBold: "BricolageGrotesque_800ExtraBold" } as const;` and `useAppFonts(): boolean` (wraps `useFonts` from the package).

- [ ] **Step 1: Write failing tests.** In `contrast.test.ts` add pairs (all 4.5): `text/surfacePressed`, `textMuted/surfacePressed`, `primary/surfacePressed`, `danger/surfacePressed`, `text/tonal`, `textMuted/tonal`, `primary/tonal`, `primary/tonalPressed`, `onPrimary/primaryPressed`, `danger/tonalDanger`, `warning/brassFill`, `slipText/slip`, `slipMuted/slip`. New `tokens.test.ts`: `it("light and dark define the same keys")` (every key of `tokens.light.colors` exists in dark and vice versa) and `it("elevation strings are non-empty in both schemes")`.
- [ ] **Step 2: Run** `npx jest src/theme` → FAIL (unknown keys).
- [ ] **Step 3: Implement** tokens and `fonts.ts`; `npx expo install @expo-google-fonts/bricolage-grotesque`; in `_layout.tsx` keep the splash screen until `useAppFonts()` is true (system font is the fallback if loading fails, never a blank app).
- [ ] **Step 4: Run** `npx jest src/theme` → PASS; full gates.
- [ ] **Step 5: Commit** `feat(theme): Ledger slip tokens, elevation, Bricolage Grotesque`.

### Task 2: Shared `Button` and `Card`

**Files:**
- Create: `src/components/Button.tsx`, `src/components/Card.tsx`, `src/components/Button.test.tsx`, `src/components/Card.test.tsx`

**Interfaces:**
- Consumes: Task 1 tokens.
- Produces: `Button` with the Fable spec 3.1 props, plus `tone?: "default" | "danger" | "muted"`. Looks (spec goal 2): primary = `primary` fill, `onPrimary` label, pressed `primaryPressed` + `transform: [{ translateY: 1 }]`, disabled = `tonal` fill + `textMuted` label (no opacity); secondary = `tonal` fill, `primary` label, pressed `tonalPressed`, danger tone = `tonalDanger` fill + `danger` label; quiet = no fill, `primary` label underlined (`textDecorationLine: "underline"`), muted tone `textMuted` not underlined, pressed `opacity: state.pressedOpacity`. `minHeight: size.touch`, radius `control`, primary gets `boxShadow` `0 6px 14px -8px rgba(31,92,76,0.7)` in light only.
- Produces: `Card` with Fable 3.2 props minus `elevation` (cards are flat): 1 px `border` hairline, radius `control`, `surface` fill, pressed `surfacePressed`, `selected?: boolean` → `tonal` fill.

- [ ] **Step 1: Write failing tests.** `Button.test.tsx`: `renders accessibilityRole button with label as name`, `does not call onPress when disabled`, `does not call onPress when busy and announces busy`, `busy keeps the label in the tree (opacity 0) so width is stable`, `danger secondary uses tonalDanger fill`. `Card.test.tsx`: `renders a View without onPress`, `renders a button with onPress`, `selected uses tonal fill`.
- [ ] **Step 2: Run** `npx jest src/components/Button src/components/Card` → FAIL (module not found).
- [ ] **Step 3: Implement** both components (each a single `<Pressable accessibilityRole="button">` so `pressableGuard.test.ts` stays green).
- [ ] **Step 4: Run** → PASS; full gates.
- [ ] **Step 5: Commit** `feat(ui): shared Button and Card`.
- [ ] **Step 6: Owner check-in 1.** Report: tokens and components exist, no screen changed yet. Wait for "go".

## Checkpoint 2: migrate screens to the new look

### Task 3: OptionRow, chips, rows, side rail

**Files:**
- Modify: `src/components/OptionRow.tsx`, `src/review/ReviewFields.tsx` (chips ~200), `src/search/SearchScreen.tsx` (chips ~147), `src/search/FilterSheet.tsx` (~114), `src/receipts/ReceiptRow.tsx`, `src/layout/SideRail.tsx`
- Test: `src/components/OptionRow.test.tsx` (create), existing screen tests

**Interfaces:**
- Produces: `OptionRow` gains `role?: "radio" | "checkbox"` (default radio), pressed `surfacePressed`, selected `primary` fill / `primaryPressed` pressed, radius `control`, label `type.label`.

- [ ] **Step 1: Failing tests** in `OptionRow.test.tsx`: `defaults to radio role`, `role checkbox reports checked state`, `selected row uses primary fill`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; FilterSheet category rows use `<OptionRow role="checkbox">`; chips and `ReceiptRow` press to `surfacePressed`, selected (two-pane) row uses `tonal`; ReceiptRow money uses `type.money` with `flexShrink: 0` and `numberOfLines={1}` (never shrinks), merchant text `flexShrink: 1` + `numberOfLines={1}` (ellipsis); test `"long merchant truncates, amount stays whole"` in `src/receipts/ReceiptList.test.tsx` (style props on both Texts); rows separated by a 1 px dashed `border` line (`borderStyle: "dashed"` on the row's top edge, not the first row); SideRail colours from tokens, focused item `tonal` pill.
- [ ] **Step 4: Run** `npx jest src/components src/search src/review src/receipts src/layout` → PASS; full gates.
- [ ] **Step 5: Commit** `feat(ui): OptionRow states, chips and rows on Ledger tokens`.

### Task 4: Button/Card call-site migration

**Files:** every site in Fable spec section 4.1–4.4 (line numbers there are for commit 75cd660; re-locate by content). Modify `src/components/pressableGuard.test.ts`.

**Interfaces:**
- Consumes: Task 2 `Button`, `Card`; Task 3 `OptionRow`.

- [ ] **Step 1: Failing guard tests** in `pressableGuard.test.ts`: change `expect(seen).toBeGreaterThan(40)` to `toBeGreaterThan(15)`; add `it("no product file imports Button from react-native")` scanning `src/**/*.tsx` outside `src/dev/` and tests for `import { ... Button ... } from "react-native"`.
- [ ] **Step 2: Run** `npx jest src/components/pressableGuard` → FAIL (native Button imports in `capture.tsx`, `ErrorPanel`, `DbErrorScreen`).
- [ ] **Step 3: Migrate** per the map, one screen per commit-sized chunk; keep every `accessibilityLabel` and visible string identical; the `ErrorPanel` Retry becomes `variant="primary"`; disabled opacity 0.5 sites become `disabled` (tonal look).
- [ ] **Step 4: Run** full `npx jest` → PASS (screen tests query by role/label, labels unchanged); full gates.
- [ ] **Step 5: Commit** `refactor(ui): screens use shared Button and Card`.

### Task 5: Fable defect fixes and Ledger touches

**Files:** `src/app/(tabs)/index.tsx` (draft banner), `src/backup/BackupScreen.tsx` (~467 inputs), `src/capture/CaptureSheet.tsx`, `src/receipts/TotalsHeader.tsx` (no slip yet), inputs across forms
- Test: `src/capture/CaptureSheet.test.tsx` (create if absent), existing tests

- [ ] **Step 1: Failing tests:** `CaptureSheet` `"scan option is the primary (filled) choice"` (scan row has `primary` background), `"sheet has the sheet elevation"`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement:** draft banner = `brassFill` fill, `brassRing` 1 px inset ring, `warning` text, 10 dp brass dot, trailing "›", `marginHorizontal: spacing.sm` (Fable 5.2, no bleed); backup inputs `surface` fill; all text inputs radius `control`, 1.5 px `border`, focused border `primary` + `boxShadow: 0 0 0 4px <tonal>`; CaptureSheet: top radius `sheet`, `elevation.sheet`, 40×4 grab handle, options radius `control` on `tonal` with `primary` label, scan option `primary` fill + `onPrimary` label.
- [ ] **Step 4: Run** → PASS; full gates.
- [ ] **Step 5: Commit** `fix(ui): banner, inputs and add sheet in Ledger style`.
- [ ] **Step 6: Owner check-in 2.** Redmi screenshots (light, dark) of feed, detail, review, settings, backup, export, add sheet vs the `audit/` before shots. Wait for "go".

## Checkpoint 3: slip and floating bar

### Task 6: Slip header with torn edge, green status area

**Files:**
- Create: `src/receipts/SlipEdge.tsx`, `src/receipts/SlipEdge.test.tsx`, `src/receipts/slipAmount.ts`, `src/receipts/slipAmount.test.ts`, `src/stats/compactAmount.ts`, `src/stats/compactAmount.test.ts`
- Modify: `src/receipts/TotalsHeader.tsx`, `src/layout/StatusBarInset.tsx`, `src/receipts/ReceiptListDetail.tsx`, `src/app/(tabs)/index.tsx`, `src/theme/ThemedStatusBar.tsx`
- Test: `src/receipts/TotalsHeader.test.tsx` (create), `src/layout/statusBarInset.test.tsx`

**Interfaces:**
- Produces: `compactAmount` exactly as specified in Task 8's Interfaces (it is built here, first use; Task 8 only consumes it), with its tests from Task 8 Step 1 (Review Focus 3).
- Produces: `slipAmountText(minor: number, currency: string, locale: string, maxChars = 16): { text: string; exact: string; compact: boolean }` in `src/receipts/slipAmount.ts`: full `formatMoney` when it is at most `maxChars` characters, else `compactAmount`; `exact` is always the full form (used for the accessibility label).
- Produces: `StatusBarInset({ children, color?: string })`; `ReceiptListDetail` gains `topInsetColor?: string` passed to the list pane's `StatusBarInset`. `SlipEdge({ color: string })` draws the zigzag/scallop with plain Views: after `onLayout` width `w`, render `Math.ceil(w / 10)` circles of diameter 10 in `color` (the page background), centred on the slip's bottom edge.

- [ ] **Step 1: Failing tests:** `SlipEdge` `"renders ceil(width/10) teeth after layout"` (fire `layout` with width 360 → 36 children); `TotalsHeader` `"amounts are single-line and shrink to fit"` (`numberOfLines={1}`, `adjustsFontSizeToFit`, `minimumFontScale={0.6}`, `ellipsizeMode` absent on both amounts), `"cell accessibility label keeps the combined totalLine text"`; `slipAmount.test.ts`: `"Rp 198.238.841 stays full"`, `"IDR 10^12 major switches to compact and keeps exact"`, `"JPY ¥123,456,789,012 switches to compact"`; `statusBarInset` `"uses the given color"`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement:** TotalsHeader becomes the slip (`slip` fill, labels `slipMuted`, amounts `type.display` + `type.money` in `slipText`, currency prefix smaller) with `SlipEdge color={background}` at its bottom; Home passes `topInsetColor={colors.slip}`; Home sets light status-bar icons while focused (`setStatusBarStyle("light")` in `useFocusEffect`, restore the themed style on blur).
- [ ] **Step 4: Run** → PASS; full gates.
- [ ] **Step 5: Commit** `feat(feed): Ledger slip header with torn edge`.

### Task 7: Floating duo tab bar and shared add trigger

**Files:**
- Create: `src/capture/useAddReceipt.tsx`, `src/capture/useAddReceipt.test.tsx`, `src/layout/useTabBarSpace.ts`
- Modify: `src/layout/BottomTabBar.tsx`, `src/layout/tabs.ts`, `src/app/(tabs)/index.tsx`, `src/receipts/feedFab.ts` (+ test), `src/receipts/ReceiptList.tsx`, `src/search/SearchScreen.tsx`, `src/organize/FoldersScreen.tsx`, `src/app/(tabs)/settings.tsx`, `src/receipts/ReceiptDetail.tsx`, `package.json`
- Test: `src/layout/BottomTabBar.test.tsx` (create), `src/receipts/feedFab.test.ts`

**Interfaces:**
- Produces: `useAddReceipt(): { open(): void; sheet: React.ReactElement }`. It moves `start(mode)` from `src/app/(tabs)/index.tsx` unchanged: same `mayStartCapture` gate, manual draft, `pendingCaptures` token, `afterUnlock` push.
- Produces: `useTabBarSpace(): number`. It returns `insets.bottom + 12 + size.capsule + 24` on compact and 0 otherwise. Every tab screen's scroll/list adds it as bottom padding.
- Produces: `TAB_ICONS: Record<TabRoute, keyof typeof Ionicons.glyphMap>` in `tabs.ts`:
  - `index`: `"receipt-outline"`
  - `search`: `"search-outline"`
  - `folders`: `"folder-outline"`
  - `settings`: `"settings-outline"` (a gear)
- `feedFabVisible(windowClass, selected)` now returns `windowClass !== "compact"`.

- [ ] **Step 1: Write the failing tests** in `BottomTabBar.test.tsx`:
  - `"renders a tablist with 4 tabs and a separate add button labelled Tambah struk"`
  - `"bar sits insets.bottom + 12 above the screen bottom"`: mock insets.bottom 47 and expect `bottom: 59`.
  - `"tab labels cap font scaling at 1.3"`
  - `"focused tab has the tonal pill"`
  - `"add button opens the add sheet"`

  Update `feedFab.test.ts`: the FAB is visible only on medium/expanded.
- [ ] **Step 2: Run** `npx jest src/layout src/receipts/feedFab src/capture` → FAIL.
- [ ] **Step 3: Implement.**
  - Run `npx expo install @expo/vector-icons`.
  - The bar is `position: "absolute"`, left/right 12, gap 8.
  - Capsule: `surface` at 92% opacity (`${surface}EB`), 1 px `border` ring, inner top highlight, `elevation.raised`. Height `size.capsule`, `paddingHorizontal: 8`, `paddingVertical: 6`.
  - Each tab: icon 22 over label `type.caption` 10 sp semibold with `maxFontSizeMultiplier={1.3}`, `paddingHorizontal: 4`. The focused tab gets a `tonal` pill with `primary` colour.
  - The + is `size.plus` round, `primary`, `elevation.raised`, and calls `useAddReceipt().open`.
  - The feed renders its FAB only on wide layouts, using the same hook; the FAB drops its legacy `elevation`/`shadow*` props for `elevation.raised`, radius 20 (Fable 5.4, Ledger look).
  - Apply `useTabBarSpace()` to each tab screen.
- [ ] **Step 4: Run** → PASS; full gates.
- [ ] **Step 5: Commit** `feat(nav): floating duo tab bar with shared add button`.
- [ ] **Step 6: Owner check-in 3.** Take Redmi screenshots of the feed:
  - light and dark
  - gesture and 3-button navigation (`settings put global force_fsg_nav_bar 0/1`; restore 1)
  - font scale 2.0 (`settings put system font_scale 2.0`; restore the original value)
  - landscape side rail

  Wait for "go".

## Checkpoint 4: stats

### Task 8: Stats queries and pure stats module

**Files:**
- Modify: `src/db/repositories/receiptQueries.ts` (+ test)
- Create: `src/stats/stats.ts`, `src/stats/stats.test.ts` (`compactAmount` already exists from Task 6)

**Interfaces:**
- Produces in `receiptQueries.ts` (all on `conditions()` + `totalColumns()`):
  - `ReceiptFilter.unconvertedFor?: string`. This matches rows NOT converted to that home, the inverse of `totalColumns`' `converted` rule.
  - `totalsByCategory(db, filter, home): { categoryId: string | null; total: HomeTotal }[]`, ordered by `homeMinor` desc.
  - `topMerchants(db, filter, home, limit: number): { merchant: string | null; total: HomeTotal }[]`.
  - `totalsByFolder(db, filter, home): { folderId: string; total: HomeTotal }[]`. Only rows with a folder; ordered by `homeMinor` desc.
- Produces in `stats.ts`:
  - `pacePeriods(today: string): { current: { from: string; to: string }; previous: { from: string; to: string }; previousMonth: string }`. The previous range ends at `min(day, lastDayOfPrevMonth)`.
  - `taxYearPacePeriods(today: string, startMonth: number)`: same shape, for the same date in the previous tax year.
  - `pacePercent(current: number, previous: number): number | null`. Null when previous is 0; rounded to a whole percent.
  - `categoryStrip(rows, topN = 3): { categoryId: string | null; share: number }[]`.
    - `default:other` and `null` are never placed in the top slots.
    - Everything else goes into a final `{ categoryId: "rest" }` item.
    - Shares sum to 1. Returns `[]` when fewer than 2 categories have a converted amount, or when the total is 0.
  - `lastMonths(today: string, n: number): string[]`. Returns "YYYY-MM" keys, oldest first.
  - `taxYearMonths(ty, startMonth): string[]`.
- Specifies (built in Task 6) `compactAmount(minor: number, currency: string, locale: string): string`. Uses `Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1, style: "currency", currency })`, with a hand-rolled fallback:
  - thresholds 1e3, 1e6, 1e9, 1e12
  - suffixes per locale: id `rb/jt/M/T`; en `K/M/B/T`; es `mil/M/mil M/B`; pt-BR `mil/mi/bi/tri`

- [ ] **Step 1: Write the failing tests.**
  - Query tests on `testDb()`:
    - `totalsByCategory` groups and keeps `null` as its own row.
    - `unconvertedFor` matches only rows whose `homeCurrencyAtSave` differs or whose `amountHomeMinor` is null.
    - `topMerchants` respects `limit`.
  - Stats tests (the Review Focus items 1, 2 and 5):
    - `pacePeriods("2026-03-31")`: previous is `2026-02-01..2026-02-28`.
    - `pacePeriods("2024-03-30")`: previous ends `2024-02-29`.
    - `pacePercent(1200, 0)` is `null`.
    - `pacePercent(1120, 1000)` is `12`.
    - `categoryStrip` never puts `default:other` in the top 3.
    - `categoryStrip` with a single category returns `[]`.
    - `taxYearMonths` with start month 4 begins at April.
  - Compact tests (Review Focus 3; written in Task 6):
    - `compactAmount(3_130_000_000, "IDR", "id")` contains `31,3`.
    - JPY 1_234_567 in `en` contains `1.2`.
    - IDR 10^14 minor stays at most 12 chars.
    - The fallback path is used when `Intl.NumberFormat` throws on `notation`. Mock it.
- [ ] **Step 2: Run** `npx jest src/stats src/db/repositories/receiptQueries` and expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS; full gates.
- [ ] **Step 5: Commit** `feat(stats): grouped totals, pace, category strip, compact amounts`.

### Task 9: Statistik screen

**Files:**
- Create: `src/app/stats.tsx` (thin route), `src/stats/StatsScreen.tsx`, `src/stats/StatsScreen.test.tsx`, `src/stats/MonthBars.tsx`
- Modify: `src/i18n/locales/{en,id,es,pt-BR}.json`

**Interfaces:**
- Consumes: the Task 8 functions, `StatusBarInset`, `Button`, `Card`, `compactAmount`.
- Produces: the route `/stats`. Search accepts the param `unconverted=1` (Task 10 consumes it).

**New strings.** Give en and id exactly as below. Translate es and pt-BR from en in the style of the existing locale files.

| Key | en | id |
|---|---|---|
| `stats.title` | Statistics | Statistik |
| `stats.month` | Month | Bulan |
| `stats.taxYear` | Tax year | Tahun pajak |
| `stats.running` | in progress, to day {{day}} | berjalan, s.d. tgl {{day}} |
| `stats.pace` | {{arrow}} {{pct}}% vs {{period}} to day {{day}} | {{arrow}} {{pct}}% dibanding {{period}} s.d. tgl {{day}} |
| `stats.lastMonths` | Last 6 months | 6 bulan terakhir |
| `stats.categories` | Categories | Kategori |
| `stats.merchants` | Top merchants | Toko teratas |
| `stats.folders` | Trips & projects | Perjalanan & proyek |
| `stats.unconverted` | Not converted | Belum dikonversi |
| `stats.unconvertedBody` | {{count}} receipts are not in the total. | {{count}} struk belum masuk total. |
| `stats.seeReceipts` | See receipts | Lihat struk |
| `stats.uncategorized` | No category | Tanpa kategori |
| `stats.openStats` | See statistics | Lihat statistik |
| `stats.empty` | Statistics appear after a few receipts. | Statistik muncul setelah beberapa struk. |

- [ ] **Step 1: Write the failing tests** in `StatsScreen.test.tsx`, seeding a `testDb`:
  - `"Bulan shows period total, 6 month bars, categories, merchants"`
  - `"Tahun pajak with start month 4 shows 12 bars from April"`
  - `"pace line hidden when last month has no converted total"`
  - `"unconverted card shows count and Lihat struk opens search with unconverted=1"`. Assert the `router.push` args.
  - `"sparse state hides folders and unconverted sections"`
  - `"uncategorized and Lainnya are separate rows"`
- [ ] **Step 2: Run** and expect FAIL.
- [ ] **Step 3: Implement.** Follow the stats mockup:
  - Segmented switch (two 48 dp `Pressable`s with `accessibilityRole="tab"`).
  - Period total in `type.display`.
  - `MonthBars` built from Views, using the `bar` token, with the current month in `primary`, and a 2 dp gap at the compared day on the previous month.
  - Ranked rows with a share bar.
  - Merchants and folders as rows.
  - A brass unconverted card.

  Recompute on `useDataVersion()`.
- [ ] **Step 4: Run** and expect PASS; full gates.
- [ ] **Step 5: Commit** `feat(stats): Statistik screen`.

### Task 10: Slip stats line and unconverted search filter

**Files:**
- Modify: `src/receipts/TotalsHeader.tsx`, `src/search/filterState.ts` (+ test), `src/search/SearchScreen.tsx` (+ test), `src/search/FilterSheet.tsx`, locales (`search.unconverted`: en "Not converted", id "Belum dikonversi")
- Test: `src/receipts/TotalsHeader.test.tsx`, `src/search/filterState.test.ts`, `src/search/SearchScreen.test.tsx`

**Interfaces:**
- `SearchState.unconverted: boolean`. `toFilter` sets `unconvertedFor: home`, so `toFilter` takes `home`. It counts in `activeFilterCount` and shows a removable chip.
- `SearchScreen` seeds `unconverted: true` from the route param `unconverted=1`.

- [ ] **Step 1: Write the failing tests.**
  - TotalsHeader:
    - `"pace line shows ▲ 12% dibanding Oktober (s.d. tgl 16)"`, with fixed `today` and seeded months.
    - `"strip has top-3 + Lainnya segments and a legend"`
    - `"whole slip is one button that opens /stats, label Lihat statistik"`
    - `"no pace line and no strip in the first month"`
  - filterState:
    - `"unconverted maps to unconvertedFor home"`
    - `"unconverted counts as an active filter"`
  - SearchScreen:
    - `"param unconverted=1 shows the Belum dikonversi chip and only unconverted receipts"`
- [ ] **Step 2: Run** and expect FAIL.
- [ ] **Step 3: Implement.**
  - Slip stats are drawn in `slipText` at four strengths: 1, 0.8, 0.6 and 0.35 for the strip segments. There is no red or green.
  - The strip is 8 dp tall, with a wrapping legend.
  - A dashed foot row holds "N belum dikonversi" and "Lihat statistik ›".
  - The whole slip is one `Pressable` with `accessibilityRole="button"`, and its label is the combined text.
- [ ] **Step 4: Run** and expect PASS; full gates.
- [ ] **Step 5: Commit** `feat(stats): slip stats line and unconverted search filter`.
- [ ] **Step 6: Owner check-in 4.** Show Redmi screenshots of the slip and of Statistik in Bulan, Tahun pajak and the sparse state, in light and dark. Wait for "go".

## Checkpoint 5: device pass

### Task 11: Device acceptance and docs

**Files:**
- Create: `docs/redesign-acceptance.md`
- Modify: `docs/superpowers/specs/2026-11-04-my-expenses-book-design.md` (non-goal line), `docs/m4-acceptance.md` (note that the screens changed)

- [ ] **Step 1: Run the gates.** Record the outputs: `npx jest`, `npx tsc --noEmit`, `npx expo lint`, `npm run check:pii`, `npx expo-doctor`.
- [ ] **Step 2: Redmi pass, over wireless adb with the dev server running.** Cover:
  - light and dark
  - gesture and 3-button navigation
  - font scale 1.0 and 2.0
  - portrait and landscape
  - feed, detail, review, search with the unconverted filter, folders, settings, export, backup, add sheet, Statistik

  Take before/after screenshots into the scratchpad. Restore every device setting you changed:
  - `force_fsg_nav_bar 1`
  - `accelerometer_rotation 1`
  - the original `font_scale`
- [ ] **Step 3: Update the product spec non-goal.** Replace the line "budgets/analytics charts" with "budgets; charts limited to on-device spending summaries".
- [ ] **Step 4: Write `docs/redesign-acceptance.md`.** Include a PASS/FAIL table per check, plus the open items: iOS unverified, and Z Flip fold checks deferred by the owner.
- [ ] **Step 5: Commit** `docs: redesign acceptance and spec non-goal update`.
- [ ] **Step 6: Owner check-in 5.** Show the before/after gallery. Ask whether to merge `fix/device-findings` into `main`.
