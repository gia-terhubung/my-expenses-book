# Home stats: slip summary and Statistik screen

Date: 2026-11-16. Status: approved by the owner. Mockup: `docs/design/2026-11-16-stats-mockup.html`.
Part of `2026-11-16-ledger-slip-redesign-design.md`.

Mockup decisions now part of this design: slip stats are drawn in slip white at four strengths (no
red/green); October's bar shows a 2 dp gap at the compared day; Tahun pajak shows 12 month bars with
labels in whole millions ("jt"); in Bulan the folder list shows only folders with receipts that month,
with that month's amount; the sparse state hides the comparison, folders and unconverted sections;
"belum masuk total" is accurate (`totalColumns()` counts unconverted receipts separately and excludes
them from `homeMinor`).
Related: `2026-11-16-ui-polish.md` (Fable audit), the "Ledger slip" direction approved in this session
(green till-slip totals header, floating duo tab bar), product spec `2026-11-04-my-expenses-book-design.md`.

## Intent

The owner wants the Struk (home) tab to feel like a professional, modern finance app, not only a list.
People open the app mostly to scan or find a receipt, so the list stays the main thing on Home. Stats
are glanceable on the slip and complete one tap away.

Audience (product spec): travellers, freelancers, households. Each needs a different cut of the same
data: this month's pace (household), category and merchant breakdown (everyone), trips and projects
(traveller, freelancer), tax year (freelancer).

## Goals

- Slip on Home shows, under the existing "Bulan ini" and "Tahun pajak" totals:
  - a pace line: this month vs last month **at the same day of month** (1st to today vs 1st to the
    same day last month; if last month is shorter, its last day);
  - a thin stacked bar of the top 3 categories plus "Lainnya", with a small legend;
  - the existing "N belum dikonversi" note when foreign receipts lack a rate;
  - a tap affordance; tapping opens Statistik.
- New Statistik screen (pushed route, back button, no new tab), with a Bulan / Tahun pajak switch:
  1. bars for the last 6 months in home currency, current month highlighted and marked as running;
  2. categories ranked with bar, amount and percent;
  3. top 5 merchants;
  4. active trips and projects (folders) with totals;
  5. "Belum dikonversi": count and a "Lihat struk" link to Search filtered to unconverted receipts (bulk rate entry is v1.1).
- Honest sparse states: no comparison line without a previous month; no category bar with fewer than
  2 categories; empty Statistik explains what will appear and links to scanning.

## Non-goals

Budgets, forecasts, donut or pie charts, daily heatmaps, generated "insight" sentences, any comparison
that needs a guess. Per-currency breakdowns (everything is in home currency; unconverted receipts are
counted, never estimated).

## Anti-goals

- Any network call or telemetry. All numbers come from the local database.
- Numbers that silently exclude data. Every total that leaves out unconverted receipts says so.
- Moralising colour (red = bad, green = good) on spending changes; the pace line is information.
- Slowing down the feed: the slip queries must stay cheap on 5,000+ receipts.

## Constraints

- Charts are plain `View` rectangles (bars, stacked bars). No SVG or chart library: `react-native-svg`
  is not installed and adding it needs a new native build.
- Ledger slip tokens and type; every text pair at 4.5:1 or more, light and dark; touch targets at least
  48 dp; amounts never wrap mid-number (shrink to fit on one line).
- Works in the two-pane layout (unfolded / tablet) and the landscape side rail.
- Product spec change: the v1 non-goal "budgets/analytics charts" becomes "budgets; charts limited to
  on-device spending summaries".

## Approaches considered

1. **Glanceable slip plus a Statistik screen opened from the slip** (picked by the owner). Home stays
   list-first; full stats are one tap away; no fifth tab, so the floating duo bar keeps four tabs.
2. Stats on Home above the list: the list gets pushed down on every open, for the minority of opens
   that want stats.
3. A fifth "Statistik" tab: breaks the four-tab capsule and duplicates the tax-year view under Folder.

## How (decided)

- Data: reuse `sumHome` (with `from`/`to`) for the pace line and `monthTotals` for the 6-month bars.
  Add three grouped queries in `receiptQueries.ts` on the same `conditions()` and `totalColumns()`:
  totals by category, by merchant (top N), by folder (trip/project kinds). All honour the confirmed and
  not-deleted rules and the existing date filter.
- Periods: "Bulan" = the current calendar month; "Tahun pajak" = the current tax year from the
  existing tax-year start-month pref.
- Recompute on `useDataVersion()` like the feed does.

## Left to the builder

Exact component split, query shapes, how the switch state is kept (screen state is enough), test
layout. Visual details come from the approved mockup `docs/design/2026-11-16-stats-mockup.html`.
