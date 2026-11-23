# Guide wizard and in-place explanations

Date: 2026-11-23. Status: design, awaiting owner approval. Approach chosen by the owner: step screens
built on the existing first-run setup (option 1), with both setup steps and "how it works" cards (option C).

## 1. Intent

A tester did not understand **Month starts on**. They also did not understand why it only offers days
1-28. The owner concluded that most users likely struggle with the settings that shape their numbers.

The app needs three things:

1. A **guide** that runs on first launch and explains these settings with live examples.
2. A **Settings button to run the guide again** at any time.
3. **(i) explanations in place**, next to the settings and numbers that confuse people.

The guide must work on normal phones and on foldables: the iPhone Duo (outer screen, inner screen) and
Android foldables (Galaxy Z Fold / Flip, Pixel Fold).

Success: someone who has never seen the app can say what "This month" on Home covers, and why. They can
find the explanation again later without help.

## 2. Goals

1. First launch grows from 3 steps to 5 setup steps, followed by 3 "how it works" cards.
2. Each setup step explains itself in one or two plain sentences. It also shows a **live example** that
   changes as the user picks (for example "This month: 25 Nov – 24 Dec").
3. Settings → **Show guide** replays the whole guide. Choices save as you go, and Close leaves at any step.
4. A shared **(i) button + explanation sheet**, used in the places listed in section 6.
5. Existing users (who finished setup before this release) see a **one-time dismissible bar on Home**
   that points to the guide.
6. "Month starts on" is renamed **"Pay cycle starts on"** everywhere, in all 4 languages.
7. Folding, unfolding or rotating mid-guide keeps the step and the choices (no remount, no reset).

## 3. Non-goals

- A spotlight tour that highlights real on-screen elements (option 2, rejected: positions shift on
  every fold and rotation).
- A third-party tour library or any new native dependency. JavaScript only; no new dev build.
- (i) on every screen. Folder kind (Project vs Trip), the review "Check this" flag, export "Include
  receipt images" and backup are out of scope for this pass (possible follow-up).
- Hinge-aware layout from the native fold API (Phase 2 of the foldable spec). This design uses window
  size only.
- Changing what the settings do. Pay cycle stays 1-28; tax year stays a start month.

## 4. Anti-goals

- A guide that traps people. Every replayed screen has Close, and every card has Skip.
- Help text that is longer than the screen. One or two sentences plus the example; more goes in the
  (i) sheet.
- Text that crosses the Duo's fold line in book posture (inner screen landscape).
- Breaking the current first-run resume: a relaunch mid-setup still resumes at the saved step.
- Anything that phones home. All text and illustrations are bundled.
- Any contrast, target size or nav-bar regression against the Ledger-slip anti-goals (4.5:1 text,
  48 dp targets, nothing under the Android system bar).

## 5. Constraints

- Design language: Ledger slip (`2026-11-16-ledger-slip-redesign-design.md`). Same tokens, `Button`,
  `Card`, hairline borders, no blur, no new colours.
- Layout rules: `src/layout/layout.ts` (`layoutFor`, `useLayout`). Never branch on device model.
- Strings in `src/i18n/locales/{en,id,es,pt-BR}.json`. Every new string exists in all four.
- Prefs in `src/prefs/prefs.ts`. `onboardingStep` is persisted, so the type change must accept values
  already stored on devices ("language", "currency", "lock", "done").
- Expo SDK 58. Check versioned docs before touching any Expo API (`apps/mobile/AGENTS.md`).

## 6. The design

### 6.1 First-run guide

Order (new steps in bold):

| # | Step | Explains | Live example |
|---|---|---|---|
| 1 | Language | (as today) | – |
| 2 | Home currency | Totals and reports use it; foreign receipts are converted. (as today, plus one line) | "A €12.00 receipt shows as ≈ Rp 205.000" when home ≠ EUR, using a fixed illustrative rate labelled "example". |
| 3 | **Tax year** | When your tax year starts. Used by the "Tax year" total, tax-year folders and exports. Preselected with today's silent regional default. | "Tax year 2026/27: 1 Apr 2026 – 31 Mar 2027" from `taxYearOf` / `taxYearRange` / `taxYearLabel` for today. |
| 4 | **Pay cycle** | "Pick the day you get paid. 'This month' on Home then runs from payday to the day before the next payday. Pick 1 to use calendar months." Then: "Only days 1–28, because every month has them, so your cycle never skips in February. Paid at the very end of the month? Pick 1." | "This month: 25 Nov – 24 Dec" from `payPeriodOf(today, day)`. |
| 5 | App lock | (as today) | – |
| 6–8 | **How it works** cards | Scan, Review, Totals (6.3) | Drawn illustration |

- `OnboardingStep` becomes `"language" | "currency" | "taxYear" | "payCycle" | "lock" | "tour" | "done"`.
  `nextStep`: language → currency → taxYear → payCycle → lock → tour → done. A stored "lock" from an
  older build still works and now continues to "tour".
- The tax year step replaces the silent default with a visible choice. The currency step's Next no
  longer writes `taxYearStartMonth`. The tax year step preselects the regional default
  (`defaultTaxYearStartMonth`) and its Next writes the shown value. (My call: `taxYearStartMonth`
  defaults to 1, not null, so "already picked" can't be detected; moving the write into the step
  removes the need.)
- **Back on first run too** (my call). Every setup step after Language has Back; it moves
  `onboardingStep` to the previous step (`prevStep`, the inverse of `nextStep`), so resume still works.
  Back from the tax year step shows the value already saved, not the regional default again.
- The card index inside "tour" is component state, not persisted. A relaunch mid-tour restarts at
  card 1. (My call: three cards, low cost to repeat.)
- Finishing the tour, or Skip on any card, sets `onboardingStep = "done"` and `guideSeen = true`, then
  goes to Home as today.
- Pickers reused as-is: `LanguagePicker`, `CurrencyPicker`, `TaxYearPicker`, `MonthStartPicker`
  (`DayGrid`), `LockToggle`.

### 6.2 Replay ("Show guide")

- New route `/guide`, presented as a full-screen modal from the root stack.
- Renders the **same step components** as first run. The step lives in component state and never
  touches `onboardingStep`.
- A Close button (top end, 48 dp) on every step. Choices save immediately, exactly like Settings.
- Starts at step 1. A row of step dots shows position. Back goes one step back.
- Lock step on replay: same `LockToggle` as Settings (it already handles biometric enrolment).
- Settings gets a new group **Help** above Support, with one row: **Show guide**.
- Opening `/guide` sets `guideSeen = true`.

### 6.3 "How it works" cards

Three cards. Each card: a drawn illustration (React Native views in Ledger-slip style, no image
assets), a title, two sentences, page dots, Back / Next, and Skip.

1. **Scan.** "Tap + to scan a paper receipt, import a photo, or add one by hand. The app reads the
   merchant, date and total for you." Illustration: the round + button and a receipt.
2. **Review.** "Check what the app read, then save. A field marked 'Check this' is one the app wasn't
   sure about." Illustration: a mini review form with one highlighted field.
3. **Totals.** "Home shows this pay cycle and this tax year in your home currency. Tap the slip for
   statistics." Illustration: a mini green slip with a torn edge.

Navigation is Back / Next buttons, not swipe paging. (My call: a paged ScrollView re-measures on every
fold and jumps pages; buttons do not.)

### 6.4 Explanation (i) and sheet

- `InfoButton`: an (i) icon (Ionicons `information-circle-outline`), 48 dp hit target. Accessibility
  label "About {topic}".
- `InfoSheet`: the app's existing page-sheet modal pattern (`AppModal` + `useSheetTopInset`, like
  Settings' `PickerSheet`). Title, 2–4 short paragraphs, the same live example as the guide where one
  exists, and Done. On wide windows it uses the existing sheet-card width (`SHEET_CARD_WIDTH`).
- Topics and placement:

| Topic | Where the (i) goes |
|---|---|
| Pay cycle | Settings row "Pay cycle starts on". Inside its picker sheet the explanation is **inline text** under the grid (summary + body), replacing the current one-line help; no (i) there, so no modal on top of a modal (my call). |
| Tax year | Settings row "Tax year starts in" |
| Home currency | Settings row "Home currency" |
| Lock after | Next to the "Lock after" caption in Settings |
| Not converted | Stats "Not converted" card; Search "Not converted" filter chip. **Not on the Home slip** (my call): the slip is one pressable with one accessibility label that opens Stats, and a nested button would clash with it and be unreachable by screen readers. The slip already leads to Stats, where the (i) is. |
| Pace | Stats pace line ("↑ 12% vs October to day 14") |

- Topic text lives in i18n under `info.<topic>.title`, `info.<topic>.summary` (1–2 sentences) and
  `info.<topic>.body` (1–3 further paragraphs). Guide steps show `summary`; the sheet shows `summary`
  then `body`. So the guide and the sheet never disagree (my call).
- The pay cycle body keeps today's fact: "Exports and search use calendar months." 
- Settings rows with an (i): the row stays one tap target (opens the picker); the (i) is a separate
  target at the row's start-of-value side. It never shrinks the row below 48 dp.

### 6.5 Existing-user bar on Home

- New pref `guideSeen: boolean`, default `false`.
- Shown on Home when `onboardingStep === "done"` and `guideSeen === false`. Text: "New: a short guide
  to pay cycle and tax year." Actions: **Show guide** (opens `/guide`) and **Dismiss**.
- Both set `guideSeen = true`. Fresh installs set it at the end of first run, so they never see the bar.
- Placement: above the receipt list, below the slip, in the same position and style as the existing
  backup reminder (`BackupReminder`). If both would show, the backup reminder wins and the guide bar
  waits.
- `guideSeen` is not added to backups.

### 6.6 Layout: phones and foldables

One rule, from window size only (`useLayout` / `useWindowDimensions`):

- **Two panes** when content width ≥ 600 **and** width > height. Left pane: title, explanation, live
  example, illustration. Right pane: the picker and the footer buttons. Each pane is exactly half the
  **window** width. The gutter between them is centred on the window, so on the Duo's inner screen in
  landscape (fold at x = 475.5) and on Fold/Pixel Fold the gutter sits on the hinge.
- **One column** otherwise: normal phones, Duo outer screen, Flip, and Duo/Fold inner screen held in
  portrait. Centred column, max width 560 (as today).
- **Short windows** (height < 480, e.g. the Duo outer screen sideways, any phone in landscape): one
  column, the body scrolls, and the footer buttons stay pinned at the bottom. Short wins over two panes
  (my call: a 874×402 phone landscape would otherwise split into two cramped halves).
- The same element tree is rendered in every mode. Switching modes only changes styles (flex direction,
  widths). Fold, unfold or rotate never remounts the pickers, so the step, the selection and the
  currency search text survive. This follows the `TwoPane` approach (same tree position, style changes
  only).
- The guide has no side rail or tab bar. The safe-area insets apply (Duo inner landscape has an 84 pt
  inset on the right).

Two-pane text sketch (Duo inner, landscape):

```
┌───────────────────────────┬───────────────────────────┐
│ Step 4 of 5   ● ● ● ○ ○   │                       [×] │
│                           │  ┌──┬──┬──┬──┬──┬──┬──┐   │
│ Pay cycle starts on       │  │ 1│ 2│ 3│ 4│ 5│ 6│ 7│   │
│                           │  │ 8│..│..│..│..│..│14│   │
│ Pick the day you get      │  │15│..│..│..│..│..│21│   │
│ paid. "This month" then   │  │22│23│24│25│26│27│28│   │
│ runs payday to payday.    │  └──┴──┴──┴──┴──┴──┴──┘   │
│                           │                           │
│ ┌ This month ───────────┐ │                           │
│ │ 25 Nov – 24 Dec       │ │                           │
│ └───────────────────────┘ │       [ Back ] [ Next ]   │
└───────────────────────────┴───────────────────────────┘
                            ↑ fold
```

One-column sketch (phone):

```
Step 4 of 5  ● ● ● ○ ○       [×]
Pay cycle starts on
Pick the day you get paid…
┌ This month ──────────────┐
│ 25 Nov – 24 Dec          │
└──────────────────────────┘
[ 7 × 4 day grid ]
Only days 1–28, because…
[ Back ]            [ Next ]
```

(The × appears on replay only. First run shows no Close on setup steps. Back shows on both, from step 2.)

### 6.7 Strings

- New keys: `guide.*` (step titles, explanations, example lines, card texts, dots label "Step {{n}} of
  {{total}}", Skip, Close, Show guide), `info.*` (topics), `home.guideBar.*`, `settings.help`,
  `settings.showGuide`.
- Rename `settings.monthStart` value to "Pay cycle starts on" (en) and the matching wording in id, es,
  pt-BR. Key names stay, to avoid churn.
- Translations: written by the builder for all four locales. The owner reviews id. es and pt-BR get a
  check by a native speaker before store release (noted in followups).

## 7. Approaches considered

1. **Step screens on the existing setup** (chosen). Extends `OnboardingFlow` with two steps and three
   cards. Replay reuses the same components through `/guide`. Explanations share one `InfoSheet`.
   Trade-off: cards show drawings of the app, not the live screens. Robust across folds because it only
   uses window size.
2. **Spotlight tour on the real screens** (rejected). Dims the app and highlights real controls. Needs
   measured element positions, which change on every fold, unfold and rotation. Much more device testing,
   fragile in exactly the postures the owner wants supported.
3. **Third-party tour library** (dropped). Adds a dependency and has the same fold problems as 2.

## 8. Testing

- Unit (Jest, existing setup): `nextStep` order including the legacy "lock" value; replay never writes
  `onboardingStep`; `guideSeen` set by finish, skip, replay and dismiss; Home bar visibility rule and
  priority behind the backup reminder; layout mode rule (two panes vs column vs short) for the Duo,
  Fold and phone sizes from `src/layout/testing/layouts.ts`; live example strings for pay cycle (day 1,
  day 25, across year end) and tax year (January and April starts); every new key present in all four
  locales (the existing locales test).
- Lint and typecheck clean (`npx expo lint`, `npx tsc --noEmit`).
- Devices, in this order, via the owner's device hub:
  1. **Android** (physical). Fresh install first run, replay from Settings, each (i) sheet, Home bar
     after an upgrade install, dark mode, 3-button and gesture nav.
  2. **iPhone Duo** (simulator). Outer upright, outer sideways (short), inner landscape (two panes, gutter
     on the fold), inner portrait (column). Fold and unfold **mid-step** on the pay cycle and currency
     steps; check the selection and the search text survive.
  3. **iPhone 18** (simulator). Full first run, replay, (i) sheets, Dynamic Type at a large size.
- Screenshots for each device go to `docs/guide-evidence/`.

## 9. Left to the builder

- Exact illustration drawings for the three cards, within the Ledger-slip tokens.
- Exact wording of the (i) bodies, within section 6.4's topics and the 1–4 paragraph limit.
- Where `InfoButton` / `InfoSheet` / the guide steps live in `src/` (suggested: `src/guide/`).
- Whether the replay route reuses `OnboardingFlow` with a `mode` prop or a thin wrapper.
- The illustrative FX rate in the currency example.
