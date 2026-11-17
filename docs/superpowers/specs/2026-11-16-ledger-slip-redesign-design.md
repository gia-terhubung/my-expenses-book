# Ledger slip redesign: visual polish, floating tab bar, home stats

Date: 2026-11-16. Status: approved by the owner (mockups approved, "no blur").
Mockups (approved, open in a browser, light/dark toggle at the top):
- `docs/design/2026-11-16-ledger-slip-mockup.html`: palette, slip, cards, buttons, sheet, floating tab bar, Android nav modes.
- `docs/design/2026-11-16-stats-mockup.html`: slip stats line, Statistik screen (Bulan, Tahun pajak, sparse state).
Companion docs:
- `docs/superpowers/specs/2026-11-16-ui-polish.md` (Fable audit): component APIs, call-site map, defect fixes. This
  doc overrides its colours, elevation values and button looks; everything else in it stands.
- `docs/superpowers/specs/2026-11-16-home-stats-design.md`: stats goals, non-goals, data rules.

## Intent

Make the app look professional and distinct before the store release, without moving how people use it.
The owner found the first polish proposal "too plain" and approved the bolder "Ledger slip" direction: the
app is a book of receipts, so the one loud element is the home totals printed as a green till slip with a
torn edge; everything else is quieter and more exact. The owner also asked for an iOS-26-style floating
tab bar and spending stats on Home.

## Goals

1. **Ledger slip palette and type** (values in section "Tokens").
2. **Shared `Button` and `Card`** from the Fable spec, restyled: primary solid green with a stamp-like
   pressed state; secondary is a tonal green fill (no border); destructive is a tonal red fill; quiet is
   underlined text; disabled primary turns tonal (not half-transparent).
3. **Surfaces with meaning:** the slip (loud); raised = FAB-style round button, primary button, bottom sheet,
   tab capsule (green-tinted shadow); rows and cards = 1px green hairline, no grey drop shadow.
4. **Home slip** with torn bottom edge, totals on one line (shrink to fit), plus the stats line, category
   strip, unconverted note and "Lihat statistik ›" (stats doc).
5. **Floating "duo" tab bar** on compact (phone portrait) layouts: a capsule with 4 icon+label tabs and,
   beside it, a separate round + button that replaces the feed FAB.
6. **Statistik screen**, pushed from the slip (stats doc).
7. Fable spec defect fixes: draft banner bleed, backup inputs unfilled, tab touch targets, native
   `<Button>` replacements, disabled-look drift, press feedback everywhere.

## Non-goals

- Blur or glass effects (owner: "no blur"). No `expo-blur`, no `expo-glass-effect`.
- New native dependencies of any kind (no new dev build needed for this work).
- Layout changes the Fable spec excluded: unifying screen edge padding (16 vs 24), card gaps, section
  heading sizes, back-button styles.
- Copy changes, except the new stats strings.
- Landscape/expanded layouts beyond keeping them working: the side rail stays as is (restyled to tokens).

## Anti-goals

- Anything that phones home (fonts and icons are bundled; stats are local).
- Text that wraps mid-number, clipped labels, or targets under 48 dp.
- Contrast under 4.5:1 for any text pair, light or dark.
- Regressing the Android nav-mode behaviour: in both gesture and 3-button navigation, nothing sits
  under the system bar.

## Tokens (from the approved mockups)

Light / dark:

| Token | Light | Dark |
|---|---|---|
| background | #F2F5F1 | #0E1513 |
| surface | #FFFFFF | #17211E |
| text | #16201C | #EEF3F0 |
| textMuted | #56635D | #93A39C |
| border (hairline) | #DCE5DF | #26332E |
| primary | #1F5C4C | #74C9AE |
| primaryPressed | #174639 | #93D7C1 |
| onPrimary | #FFFFFF | #06241B |
| tonal | #E3EEE8 | #1E3A32 |
| tonalPressed | #D3E4DA | #25463C |
| danger | #B3261E | #F2B8B5 |
| tonalDanger | #FBE9E7 | #3A1F1D |
| warning / brass (text) | #7A5A12 | #E7BC5C |
| brassFill | #FBF1DA | #2A2314 |
| brassRing | #E9CF8E | #5A4823 |
| slip | #1F5C4C | #163F34 |
| slipText | #FFFFFF | #EEF3F0 |
| slipMuted | #BFD9CF | #BFD9CF |
| bar (stats charts) | #6F9E8E | #4A7A6B |

Contrast was computed for every text pair in both mockups (lowest 4.66:1); `contrast.test.ts` gets the
new pairs. Existing tokens `warning` maps to brass text.

Elevation (`boxShadow` strings, RN 0.88 New Architecture):
- `raised` light: `0 10px 22px -8px rgba(31,92,76,0.55), 0 2px 4px rgba(31,92,76,0.25)`;
  dark: `0 10px 22px -8px rgba(0,0,0,0.8), 0 0 0 1px rgba(116,201,174,0.25)`.
- `sheet` light: `0 -12px 32px -12px rgba(22,32,28,0.35)`; dark: `0 -12px 32px -8px rgba(0,0,0,0.8)`.
- cards: no shadow; 1px hairline in `border` (inset ring or borderWidth, builder's call).
- Android API 26-27 show no `boxShadow`; acceptable (Fable spec 2.2).

Radius: buttons, cards, inputs 14; sheet top 26; tab capsule and + button fully round; chips pill.

Type: Bricolage Grotesque (700/800) via `@expo-google-fonts/bricolage-grotesque` + the installed
`expo-font`, for the slip totals, screen titles, month headings and Statistik numbers. Body stays the
system font. All money uses tabular figures (`fontVariant: ["tabular-nums"]`).

## Floating duo tab bar (compact layouts only)

- No blur: capsule background is `surface` at about 92% opacity, a 1px hairline, an inner top highlight
  and the `raised`-style shadow.
- Capsule: 4 equal tabs, icon (22) above label (10sp, semibold), active tab in a `tonal` pill with
  `primary` colour. Height 60, horizontal inner padding 8, tab side padding 4, so "Pengaturan" never
  touches the pill edge (owner caught this in review).
- + button: 56 round, `primary`, `raised` shadow, beside the capsule with an 8 dp gap; screen side margins
  12. It opens the same add sheet the FAB opens today, from every tab.
- Position: bottom = system bottom inset + 12 dp. Verified rule on the Redmi: gesture inset 16 dp,
  3-button inset 47 dp. Scrollable screens under the bar add bottom padding = bar height + inset + 24.
- Icons: `@expo/vector-icons` (bundled, JS only): receipt, search, folder, and a real gear for
  Pengaturan (not a sun).
- Accessibility: keeps today's tablist/tab roles and labels; + keeps "Tambah struk".
- Medium/expanded layouts keep the side rail.


## Yellow accent and app icon (owner, 2026-11-17)

The owner picked the round-4 logo "Long page" (`docs/design/logo/meb-long-page.svg`, mono variant alongside;
yellow ground, open book whose right page runs on into a torn receipt edge) and asked to add its yellow to the
app palette. Yellow is light, so it has strict jobs:

| Token | Light | Dark | Use |
|---|---|---|---|
| highlight | #FFD84A | #FFD84A | yellow accents ON the green slip only (pace line arrow and %, "Lihat statistik ›", a 4 dp "total bar" under the Bulan ini amount, echoing the logo) |
| onHighlight | #16201C | #16201C | text on a yellow fill (12.07:1) |
| brassFill (now soft yellow) | #FFF3C4 | #2B2610 | "waiting on you" surfaces: draft banner, Belum dikonversi card |
| brassRing (now yellow) | #FFD84A | #5A4E1C | their ring and dot |
| warning (text on those) | #6B4E00 | #FFD84A | 6.95:1 / 10.94:1 |

Rules: never yellow text or yellow icons on light backgrounds (1.26:1 on #F2F5F1); never yellow chart bars on the
light background (fails 3:1 for non-text); actions stay green; yellow means "the number that matters" (on the slip)
or "waiting on you" (drafts, unconverted). Contrast: yellow on slip 5.63:1 light, 8.45:1 dark.

Rule change (owner, 2026-11-17): a yellow FILL with ink text (`onHighlight`, 12.07:1) is also allowed for one
"support the app" accent: the Kotak tip row in Settings and the tip screen's cup marks. Still never yellow text.

App icon: generate from `meb-long-page.svg`: Android adaptive (foreground inside the 66% safe zone, yellow
background layer, monochrome themed icon from the mono SVG), iOS 1024 opaque (art scaled up, not cropped), splash
icon and favicon-free (no web build). Wire through `app.config.ts` (`icon`, `android.adaptiveIcon`, iOS icon).

## Approaches considered

1. **Token + shared component pass with a distinct "Ledger slip" identity** (picked). One loud element,
   tokens and two shared components carry the rest; no layout moves except the slip growing and the tab
   bar floating.
2. Fable's neutral polish (same components, near-current palette, grey card shadows): rejected by the
   owner as too plain.
3. Native tabs (`expo-router` NativeTabs / Liquid Glass): authentic on iOS 26 but needs native
   rebuilds and two code paths; the owner chose no blur, so a custom floating bar is simpler.

## Order of work (owner-visible checkpoints)

1. Tokens, font, `Button`, `Card`, contrast test (no screen changes yet).
2. Call-site migration per the Fable map, with the new looks.
3. Slip + floating duo bar on Home.
4. Statistik screen and the slip stats line.
5. Device pass on the Redmi: light/dark, gesture and 3-button nav, large font, landscape, before/after
   screenshots for the owner.

## Calls made after the builder check (author's calls, owner may override)

1. **Status bar on Home is slip green.** As in the approved mockup. `StatusBarInset` gains an optional
   background colour; Home passes `slip`, so the fixed strip above the list is green while the slip scrolls
   away beneath it. Home uses light status-bar icons while focused; every other screen keeps the themed
   rule. Other screens are unchanged.
2. **"Lainnya" on the slip strip** = everything outside the top 3 *named* categories: the default
   `default:other` category and uncategorised receipts never take a top-3 slot and always fall into the
   rest bucket. In the Statistik list they stay separate rows: the "Lainnya" category and "Tanpa
   kategori" (new string, all 4 locales). Percentages are of the converted home total.
3. **Chart labels** use a locale-aware compact formatter (thousands / millions / billions, at most one
   decimal: "31,3 jt", "$12.4K", "R$ 3,1 mi"), scaled from the data, not fixed to millions. Built on
   `Intl.NumberFormat` compact notation with a tested hand-rolled fallback if Hermes lacks it.
4. **Pressed vs selected.** Pressed rows, cards, chips and secondary surfaces use a new neutral
   `surfacePressed` (light #E9EEEA, dark #1F2A26; lowest text pair 5.36:1). Selected uses `tonal`
   (the selected row in two-pane, the active tab pill, selected chips), so pressed and selected never look
   the same. Primary pressed stays `primaryPressed`; tonal buttons press to `tonalPressed`.
5. **Adding a receipt on wide layouts.** Compact: the + in the duo bar. Medium/expanded (side rail):
   the existing Home FAB stays. One shared add-sheet trigger (a hook) is used by both, so there is one
   sheet and one code path.
6. **"Belum dikonversi" link (owner chose A, 2026-11-16).** The Statistik card's link reads "Lihat struk"
   and opens Search with a new "Belum dikonversi" filter (`ReceiptFilter.unconverted`: not converted to the
   current home, same rule as `totalColumns()`), plus a matching filter chip. Rates are fixed per receipt in
   the edit form, as today. The bulk rate screen (option B) is v1.1: `docs/m5-followups.md`.
7. `@expo/vector-icons` is not installed yet: the plan adds it (`npx expo install`; JS only, no native
   rebuild).

## Left to the builder

Component file split, how the slip's torn edge is drawn with plain Views, test layout, exact migration
order inside step 2, query shapes for the stats.
