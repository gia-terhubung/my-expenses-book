# Guide Wizard and In-Place Explanations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 3-step first-run setup into a 5-step explained guide followed by 3 "how it works" cards, which people can replay from Settings. Add (i) explanation sheets where settings and numbers confuse people.

**Architecture:** Pure logic (step order, layout mode, live examples) lives in small tested modules. One `GuideFlow` component renders every step in a `GuideShell`. The shell switches between two panes, one column and short mode by changing styles only, so folding never remounts anything. `GuideFlow` runs in two modes: first run (step persisted in prefs) and replay (step held in component state, at `/guide`). `InfoButton` and `InfoSheet` share one set of `info.*` strings with the guide.

**Tech Stack:** Expo SDK 58, Expo Router, React Native, react-i18next, Jest + @testing-library/react-native. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-23-guide-and-info-design.md`

All paths below are relative to `apps/mobile/` unless they start with `docs/`.

## Global Constraints

- JavaScript only. No new native dependency, no new dev build, no third-party tour library.
- Ledger-slip design: existing tokens from `useTheme()`, `Button`, `Card`, hairline borders. No new colours, no blur.
- Every new string exists in `src/i18n/locales/{en,id,es,pt-BR}.json` with the same placeholders (`src/i18n/locales.test.ts` enforces this).
- Touch targets ≥ 48 dp. Text contrast ≥ 4.5:1. Nothing sits under the Android system bar.
- Layout is decided from window size only (`useWindowDimensions`, `useLayout`). Never branch on the device model.
- Fold, unfold or rotation never remounts a picker: the same element tree is rendered in every layout mode.
- `onboardingStep` must accept the values already stored on devices: `"language" | "currency" | "lock" | "done"`.
- Pay cycle stays 1–28. Tax year stays a start month.
- Run `npm run lint`, `npm run typecheck` and `npm test` before each commit. All three must be clean.
- Commits go to `main` (owner works alone). Push with `git -c http.version=HTTP/1.1 push` if the push disconnects.

## Review Focus

1. **Unfold mid-step.** On the currency step with search text typed, the window changes from 466×678 to 951×669. The text and selection must survive. Test in Task 4.
2. **Upgrade from an older build stuck on "lock".** Stored `onboardingStep = "lock"`. Next must lead to the tour, not to Home. Test in Task 1 and Task 4.
3. **Year-end pay cycle.** Day 25 on 2026-12-28 must read "25 Dec – 24 Jan" (into the next year), not a broken range. Test in Task 1.
4. **Language changed during replay.** Changing the language on step 1 of a replay must re-render the remaining steps in the new language without leaving the guide. Test in Task 4.
5. **Both Home bars due at once.** When the backup reminder and the guide bar are both due, only the backup reminder shows. Test in Task 8.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/onboarding/steps.ts` (modify) | Step order: `nextStep`, `prevStep`, `SETUP_STEPS` |
| `src/prefs/prefs.ts` (modify) | `OnboardingStep` union, `guideSeen` pref |
| `src/guide/guideLayout.ts` (create) | `guideMode()`: split / column / short |
| `src/guide/examples.ts` (create) | Live example text for pay cycle, tax year and currency |
| `src/guide/info.ts` (create) | `InfoTopic` type and i18n key helpers |
| `src/guide/InfoButton.tsx`, `src/guide/InfoSheet.tsx` (create) | (i) button and its explanation sheet |
| `src/guide/GuideShell.tsx` (create) | Step chrome: dots, Close, Back/Next, the two layouts |
| `src/guide/GuideFlow.tsx` (create) | Every step and card; `mode: "firstRun" \| "replay"` |
| `src/guide/TourCards.tsx`, `src/guide/illustrations.tsx` (create) | 3 cards and their drawings |
| `src/guide/GuideBar.tsx` (create) | One-time Home bar for existing users |
| `src/onboarding/OnboardingFlow.tsx` (modify) | Becomes `<GuideFlow mode="firstRun" />` |
| `src/app/guide.tsx` (create), `src/app/_layout.tsx` (modify) | Replay route, presented as a full-screen modal |
| `src/app/(tabs)/settings.tsx` (modify) | Help group, (i) buttons, pay-cycle inline text |
| `src/stats/StatsScreen.tsx`, `src/search/FilterSheet.tsx` (modify) | (i) for pace and not converted |
| `src/app/(tabs)/index.tsx` (modify) | Mount `GuideBar` |
| locales ×4 (modify) | New `guide.*`, `info.*` and `settings.*` keys |

---

### Task 0: One back button everywhere (owner request, 2026-11-23)

The owner asked for every page to use the same back button and header elements. Audit of today's screens:

| Screen | Today |
|---|---|
| Backup, Tip jar, Error log, Receipt (`document/[id]`) | Native stack header ("‹ Back" + centred title on iOS, arrow on Android) |
| Stats | Round 48 dp chevron icon, title on the same row |
| Folder, Tax year (`CollectionScreen`), Export, Recurring list (`RecurringList`), rule form (`RuleForm`) | Quiet text button "Back" / "‹ Back" above the title |
| Categories | Title, plus a "Done" text button on the right (though it's a pushed page) |

Rule (my call):
- Every full-screen page uses `ScreenHeader`: the Stats-style round chevron (48 dp, `colors.primary`) and the title on one row, left aligned, with optional actions at the end. This is the best of today's variants and it fits inside a split pane, which a native header doesn't.
- Bottom sheets (`PickerSheet`, `InfoSheet`) keep the title on the left and "Done" on the right.
- The guide's Close uses the same round icon button, with the `close` icon.

**Files:**
- Create: `src/components/ScreenHeader.tsx`, `src/components/IconButton.tsx`
- Modify: `src/stats/StatsScreen.tsx` (~line 248), `src/organize/CategoriesScreen.tsx` (~line 80), `src/organize/CollectionScreen.tsx` (~lines 64–67 and 118), `src/export/ExportScreen.tsx` (~line 151), `src/recurring/RecurringList.tsx` (~line 74), `src/recurring/RuleForm.tsx` (~line 250)
- Modify: `src/app/backup.tsx`, `src/app/tip-jar.tsx`, `src/app/error-log.tsx`, `src/app/document/[id].tsx` (drop `headerShown: true`; render `ScreenHeader` in the screen; remove `ReceiptDetail`'s `underHeader` path if it becomes unused), `src/app/_layout.tsx` (remove the `document/[id]` `headerShown` override)
- Test: `src/components/ScreenHeader.test.tsx`, plus updates to existing screen tests that queried the old "Back" text button

**Interfaces:**
- Produces:
  - `IconButton(props: { icon: "chevron-back" | "close"; label: string; onPress: () => void; testID?: string })`: 48×48, round pressed fill `colors.surfacePressed`, icon size 26, `colors.primary`.
  - `ScreenHeader(props: { title: string; onBack?: () => void; actions?: ReactNode; titleStyle?: "title" | "headline" })`
    - `onBack` defaults to `router.canGoBack() ? router.back() : router.replace("/")`.
    - The title has `accessibilityRole="header"` and `flexShrink: 1`, and can wrap to 2 lines.
    - `actions` sit at the row's end.
    - The row's `minHeight` is `size.touch`, with `marginLeft: -spacing.md`, so the chevron lines up with the content edge (as Stats does today).
- Later tasks use `IconButton` for the guide's Close (Task 4).

- [ ] **Step 1: Write failing tests** in `ScreenHeader.test.tsx`:
  - `"back has label 'Back', 48dp, and calls onBack"`
  - `"falls back to router.replace('/') when it can't go back"`
  - `"title is a header"`
- [ ] **Step 2:** Run `npx jest src/components/ScreenHeader`. Expected: FAIL.
- [ ] **Step 3:** Implement `IconButton` and `ScreenHeader`. Move the Stats header code into them.
- [ ] **Step 4:** Replace every variant in the table. Keep each screen's existing back behaviour as its `onBack`:
  - Collection: its `leave` fallback to `/folders`.
  - RuleForm: its `onBack` prop (one pane only). In split mode, there's no back in the form pane.
  - RecurringList: its `onBack`.
  - Categories: drop "Done" and use the chevron.
  - Collection's Export/Rename/Delete actions stay where they are, below the title.
- [ ] **Step 5:** Run `npm test`, `npm run lint` and `npm run typecheck`. Expected: all clean. Update tests that looked for the "Back" text button so they query by the label "Back".
- [ ] **Step 6:** Check visually on one Android phone and the iPhone 18 simulator. Every screen in the table shows the same chevron in the same place, in light and dark.
- [ ] **Step 7: Commit**: `fix(ui): one back button and header on every page`

---

### Task 1: Step order, prefs, layout mode, live examples

**Files:**
- Modify: `src/onboarding/steps.ts`, `src/prefs/prefs.ts`
- Create: `src/guide/guideLayout.ts`, `src/guide/examples.ts`
- Test: `src/onboarding/steps.test.ts` (extend), `src/guide/guideLayout.test.ts`, `src/guide/examples.test.ts`

**Interfaces:**
- Produces:
  - `type OnboardingStep = "language" | "currency" | "taxYear" | "payCycle" | "lock" | "tour" | "done"` (in `prefs.ts`)
  - `Prefs.guideSeen: boolean`, default `false`
  - `SETUP_STEPS: readonly ["language", "currency", "taxYear", "payCycle", "lock"]`
  - `nextStep(s: OnboardingStep): OnboardingStep`
  - `prevStep(s: OnboardingStep): OnboardingStep`
  - `type GuideMode = "split" | "column" | "short"`
  - `guideMode(input: { width: number; height: number; left: number; right: number }): GuideMode`
  - `formatDayRange(from: string, to: string, locale: string): string`
  - `payCycleExample(today: string, day: number, locale: string): string` returns the range only, e.g. "Nov 25 – Dec 24"
  - `taxYearExample(today: string, startMonth: number, locale: string): { label: string; range: string }`

- [ ] **Step 1: Write failing tests**

`steps.test.ts`:
- `nextStep`: language→currency→taxYear→payCycle→lock→tour→done; done→done.
- `prevStep`: currency→language, taxYear→currency, payCycle→taxYear, lock→payCycle, tour→lock; language→language.
- `"legacy stored lock continues to the tour"`: `expect(nextStep("lock")).toBe("tour")`.

`guideLayout.test.ts`, using the dimensions in `src/layout/testing/layouts.ts`:
- 360×800 → `"column"`
- 466×678 with right 84 → `"column"`
- 678×466 with right 84 → `"short"`
- 951×669 with right 84 → `"split"`
- 669×951 → `"column"`
- 841×701 → `"split"`
- 701×841 → `"column"`
- 874×402 → `"short"` (short wins over split)

`examples.test.ts` (build the expected value with the same `Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" })`, so the test doesn't depend on the ICU version):
- `payCycleExample("2026-11-23", 25, "en")` equals `` `${f("2026-10-25")} – ${f("2026-11-24")}` ``
- `payCycleExample("2026-12-28", 25, "en")` equals `` `${f("2026-12-25")} – ${f("2027-01-24")}` `` (year end)
- `payCycleExample("2026-11-23", 1, "en")` equals `` `${f("2026-11-01")} – ${f("2026-11-30")}` ``
- `taxYearExample("2026-11-23", 4, "en")` gives label `"2026/27"`, and its range runs from 2026-04-01 to 2027-03-31, formatted with the year (`{ day, month: "short", year: "numeric" }`)
- `taxYearExample("2026-11-23", 1, "en").label === "2026"`

- [ ] **Step 2: Run them and confirm they fail**

Run: `npx jest src/onboarding/steps.test.ts src/guide`
Expected: FAIL. `prevStep`, `guideMode` and the examples are undefined.

- [ ] **Step 3: Implement**

- `steps.ts`: a `NEXT` record plus `prevStep` (the inverse of `NEXT`, with `language` and `done` mapping to themselves).
- `prefs.ts`: widen the union and add `guideSeen: false` to `PREF_DEFAULTS`.
- `guideMode`:
  - Return `"short"` when `height < SHORT_HEIGHT`.
  - Otherwise return `"split"` when `width - left - right >= SPLIT_MIN && width > height`.
  - Otherwise return `"column"`.
  - Import both constants from `src/layout/layout.ts`.
- Examples: use `payPeriodOf`, `taxYearOf`, `taxYearRange` and `taxYearLabel`. Cache `Intl.DateTimeFormat` per locale, as `TotalsHeader` does.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx jest src/onboarding src/guide src/prefs`
Expected: PASS. Existing prefs tests still pass.

- [ ] **Step 5: Commit**: `feat(guide): step order, guide layout mode and live examples`

---

### Task 2: Strings (4 locales)

**Files:**
- Modify: `src/i18n/locales/en.json`, `id.json`, `es.json`, `pt-BR.json`
- Test: `src/i18n/locales.test.ts` (existing; add `"guide"` and `"info"` to the required namespaces)

**Interfaces:**
- Produces these keys, used by Tasks 3–8. The English copy is fixed below.

| Key | en |
|---|---|
| `settings.monthStart` (value change) | Pay cycle starts on |
| `settings.help` | Help |
| `settings.showGuide` | Show guide |
| `guide.stepOf` | Step {{n}} of {{total}} |
| `guide.close` | Close guide |
| `guide.skip` | Skip |
| `guide.finish` | Start using the app |
| `guide.taxYearTitle` | When does your tax year start? |
| `guide.payCycleTitle` | When does your month start? |
| `guide.thisMonth` | This month |
| `guide.taxYearExample` | Tax year {{label}} |
| `guide.currencyExample` | A {{foreign}} receipt shows as about {{home}} (example rate) |
| `guide.cards.scan.title` / `.body` | Add receipts / Tap + to scan a paper receipt, import a photo, or add one by hand. The app reads the merchant, date and total for you. |
| `guide.cards.review.title` / `.body` | Check and save / Check what the app read, then save. A field marked "Check this" is one the app wasn't sure about. |
| `guide.cards.totals.title` / `.body` | See your totals / Home shows this pay cycle and this tax year in your home currency. Tap the slip for statistics. |
| `guide.bar.text` | New: a short guide to pay cycle and tax year. |
| `guide.bar.open` / `guide.bar.dismiss` | Show guide / Dismiss |
| `info.about` | About {{topic}} |
| `info.payCycle.title` | Pay cycle |
| `info.payCycle.summary` | Pick the day you get paid. "This month" on Home then runs from payday to the day before the next payday. Pick 1 to use calendar months. |
| `info.payCycle.body` | Only days 1–28, because every month has them, so your cycle never skips in February. Paid at the very end of the month? Pick 1.\n\nUsed by Home and Statistics. Exports and search use calendar months. |
| `info.taxYear.title` | Tax year |
| `info.taxYear.summary` | The month your tax year starts. It sets the "Tax year" total on Home, the tax-year folders and the export presets. |
| `info.taxYear.body` | Most countries start in January. Some start in April or July. Check with your tax office if unsure. |
| `info.homeCurrency.title` | Home currency |
| `info.homeCurrency.summary` | Totals and reports use this currency. Receipts in other currencies are converted. |
| `info.homeCurrency.body` | Conversion uses the exchange rate of the receipt's date, downloaded when you're online. Until a rate is available, a receipt is counted as "not converted". |
| `info.lockAfter.title` | Lock after |
| `info.lockAfter.summary` | How long the app can be in the background before it asks you to unlock again. |
| `info.lockAfter.body` | "Immediately" is the safest. Longer times are handy when you switch apps often, for example to copy a reference number. |
| `info.unconverted.title` | Not converted |
| `info.unconverted.summary` | Receipts in another currency that don't have an exchange rate yet. They're left out of totals so the totals stay accurate. |
| `info.unconverted.body` | Rates download automatically when you're online. You can also enter a rate yourself when you edit the receipt. |
| `info.pace.title` | Pace |
| `info.pace.summary` | Compares what you've spent so far with the same number of days in the last period. |
| `info.pace.body` | "↑ 12% vs October to day 14" means you've spent 12% more by day 14 than you had by day 14 of October. |

- `onboarding.currencyHint` stays. The currency step shows `info.homeCurrency.summary` in its place, so mark `onboarding.currencyHint` for removal and delete it in Task 4 if it ends up unused.
- `settings.monthStartHelp` is deleted in Task 6.
- Translations: id, es and pt-BR are written by the implementer. Note in `docs/m5-followups.md`: "guide/info copy: id owner review; es/pt-BR native check before release".

- [ ] **Step 1:** Add `"guide"` and `"info"` to the namespace list in `locales.test.ts`. Run `npx jest src/i18n`. Expected: FAIL.
- [ ] **Step 2:** Add the keys to all four files.
- [ ] **Step 3:** Run `npx jest src/i18n`. Expected: PASS (key sets equal, no empty strings, placeholders consistent).
- [ ] **Step 4: Commit**: `feat(i18n): guide and info strings; "Pay cycle starts on"`

---

### Task 3: InfoButton and InfoSheet

**Files:**
- Create: `src/guide/info.ts`, `src/guide/InfoButton.tsx`, `src/guide/InfoSheet.tsx`
- Test: `src/guide/InfoButton.test.tsx`

**Interfaces:**
- Consumes: the `info.*` keys (Task 2).
- Produces:
  - `type InfoTopic = "payCycle" | "taxYear" | "homeCurrency" | "lockAfter" | "unconverted" | "pace"`
  - `InfoButton(props: { topic: InfoTopic; example?: string; testID?: string })`: renders the icon and owns the sheet's open state.
  - `InfoSheet(props: { topic: InfoTopic; example?: string; onClose: () => void })`
  - `InfoText(props: { topic: InfoTopic; showSummary?: boolean })`: summary plus body paragraphs (split on `\n\n`). Used inline by Task 6.

- [ ] **Step 1: Write the failing tests**
  - `"has a 48dp target and an 'About Pay cycle' label"`: query by label `"About Pay cycle"`. Its flattened style or `hitSlop` gives ≥ 48 in both directions.
  - `"opens the sheet with title, summary, body and example"`: press it. Expect the texts "Pay cycle", the start of the summary, "Exports and search use calendar months." and the example string passed in.
  - `"Done closes the sheet"`.
- [ ] **Step 2:** Run `npx jest src/guide/InfoButton`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Icon: `Ionicons` `information-circle-outline`, size 20, colour `textMuted`, inside a 48×48 `Pressable` with `accessibilityRole="button"`.
  - Sheet: same structure as `PickerSheet` in `settings.tsx`: `AppModal` with `presentationStyle="pageSheet"` and `useSheetTopInset`, max width 560, centred.
  - The example sits in a `Card` above the paragraphs.
- [ ] **Step 4:** Run `npx jest src/guide`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(guide): InfoButton and InfoSheet`

---

### Task 4: GuideShell + GuideFlow setup steps; first run uses it

**Files:**
- Create: `src/guide/GuideShell.tsx`, `src/guide/GuideFlow.tsx`
- Modify: `src/onboarding/OnboardingFlow.tsx` (body becomes `return <GuideFlow mode="firstRun" />`)
- Test: `src/onboarding/OnboardingFlow.test.tsx` (keep its existing tests passing; extend), `src/guide/GuideFlow.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`nextStep`, `prevStep`, `SETUP_STEPS`, `guideMode`, examples), Task 3 (`InfoText` is not needed here; use `t("info.<topic>.summary")` directly).
- Produces:
  - `GuideFlow(props: { mode: "firstRun" | "replay"; onClose?: () => void })`
  - `GuideShell(props: { mode: GuideMode; dots: { n: number; total: number }; title: string; explain: ReactNode; control: ReactNode; footer: ReactNode; onClose?: () => void })`
    - `explain` = text, example card and illustration. It goes in the left pane in split mode.
    - `control` = the picker. It goes in the right pane.
    - `footer` = the buttons.

Behaviour:
- **First run:** the step comes from `usePref("onboardingStep")`. Next calls `prefs.set("onboardingStep", nextStep(step))`. Back calls `prevStep`. There's no Close. Back shows from currency onward.
- **Replay:** the step is `useState<OnboardingStep>("language")`. It never writes `onboardingStep`. Close (`IconButton icon="close"` from Task 0, top end, label `guide.close`) calls `onClose`.
- **Tax year step:**
  - Local `useState(() => saved value if the step was already passed in this run, else defaultTaxYearStartMonth(regionCode))`. Concretely: in replay, always use the saved pref. In first run, use the regional default on first arrival.
  - Next writes it.
  - Explain = `info.taxYear.summary` plus the example card (`guide.taxYearExample` + range).
- **Pay cycle step:** `MonthStartPicker` writes `monthStartDay` directly. Explain = `info.payCycle.summary`, an example card ("This month" + `payCycleExample`), then `info.payCycle.body`.
- **Currency step:**
  - Explain = `info.homeCurrency.summary`, plus the example `guide.currencyExample` when home ≠ EUR. The foreign amount is €12.00. The home amount uses fixed illustrative rates in `examples.ts` (`EXAMPLE_RATES_PER_EUR: Record<string, number>`; fall back to no example for a currency not in the table).
  - The currency step's Next no longer writes `taxYearStartMonth`.
- **Lock step's Next:**
  - First run: Next goes to `"tour"`.
  - Replay: Next goes to the tour cards.
  - The cards themselves come in Task 5. Until then, `"tour"` renders a placeholder whose Next calls finish.
- **Finish (first run):** set `onboardingStep = "done"` and `guideSeen = true`, then `router.replace("/")`.
- **GuideShell layout:**
  - One tree: `View` root → [header row: dots and the optional Close] → `View` body with `flexDirection: mode === "split" ? "row" : "column"` → [`ScrollView` explain pane, `View` control pane] → footer.
  - In split mode, each pane's `width` is `windowWidth / 2` minus the left/right inset share, so the gutter sits on the window centre. In column and short modes, the width is `"100%"` with max width 560, centred.
  - In short mode, the whole body is one `ScrollView` and the footer stays outside it, pinned. Change style keys only, never the element types.

- [ ] **Step 1: Write the failing tests**

In `OnboardingFlow.test.tsx`:
- `"first run walks language → currency → tax year → pay cycle → lock"`: press Next and assert each title in turn (`onboarding.languageTitle`, `onboarding.currencyTitle`, `guide.taxYearTitle`, `guide.payCycleTitle`, `onboarding.lockTitle`).
- `"Back on pay cycle returns to tax year and persists the step"`: `mockStore.get("onboardingStep") === "taxYear"`.
- `"tax year preselects the regional default and Next saves it"`: the mock region is ID → `defaultTaxYearStartMonth("ID")`. After Next, `taxYearStartMonth` equals it.
- `"legacy stored 'lock' leads to the tour, not Home"`: seed `onboardingStep = "lock"`, press Next. `mockReplace` is not called, and `onboardingStep === "tour"`.
- `"pay cycle example follows the picked day"`: pick day 25 and expect the text `payCycleExample(today, 25, "en")`. Use `src/dates/clock` the way existing tests fix time (see `src/app/(dev)/dev/clock.tsx` / `now()`).
- `"unfold mid-step keeps currency search text"`:
  1. Seed the currency step and type "yen" into the search.
  2. Set `dims` to 466×678 and rerender.
  3. Then set `dims` to 951×669 and rerender.
  4. The search input still has the value "yen".

In `GuideFlow.test.tsx`:
- `"replay never writes onboardingStep"`: seed `"done"`, render `mode="replay"`, Next through every step. The value stays `"done"`.
- `"replay Close calls onClose"`.
- `"changing language in replay re-renders the next step in that language"`: pick Bahasa Indonesia, press Next, and expect the id `onboarding.currencyTitle` text.

- [ ] **Step 2:** Run `npx jest src/onboarding src/guide`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement `GuideShell`, `GuideFlow` and the `OnboardingFlow` swap. Load `frontend-design:frontend-design` before styling the shell, the dots and the example card. Keep within the Ledger-slip tokens.
- [ ] **Step 4:** Run `npm test`. Expected: PASS, including the old onboarding tests (adjust only tests that asserted the old 3-step order).
- [ ] **Step 5: Commit**: `feat(guide): explained setup steps with live examples, back, fold-safe layout`

---

### Task 5: "How it works" cards

**Files:**
- Create: `src/guide/TourCards.tsx`, `src/guide/illustrations.tsx`
- Modify: `src/guide/GuideFlow.tsx` (replace the Task 4 placeholder)
- Test: `src/guide/TourCards.test.tsx`

**Interfaces:**
- Consumes: `GuideShell` (Task 4); `guide.cards.*` (Task 2).
- Produces:
  - `TourCards(props: { mode: GuideMode; onBackFromFirst: () => void; onDone: () => void })`
  - `ScanIllustration`, `ReviewIllustration`, `SlipIllustration`: no props; plain RN `View`/`Text` built from theme tokens; hidden from accessibility.

Behaviour:
- Card index is `useState(0)`.
- Next on card 3 shows `guide.finish` and calls `onDone`.
- Skip on any card calls `onDone`.
- Back on card 1 calls `onBackFromFirst` (to the lock step).
- Buttons only, no swipe paging.
- The illustration goes in the explain pane and the text in the control pane in split mode. In column mode they stack.

- [ ] **Step 1: Write the failing tests**
  - `"Next steps through 3 cards then finishes"`
  - `"Skip finishes from card 1"`
  - `"Back on card 1 calls onBackFromFirst"`
  - `"illustrations are hidden from screen readers"`: there are no accessible elements inside the test IDs `guide-illustration-*`.
- [ ] **Step 2:** Run `npx jest src/guide/TourCards`. Expected: FAIL.
- [ ] **Step 3:** Implement. Wire into `GuideFlow`:
  - First run: `onDone` = finish (Task 4).
  - Replay: `onDone` = `onClose`.
  - Draw the illustrations with the `frontend-design` guidance: the slip uses `colors.slip*` and the existing `SlipEdge`; the + button uses the primary round-button look.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(guide): how-it-works cards`

---

### Task 6: Replay route and Settings

**Files:**
- Create: `src/app/guide.tsx`
- Modify: `src/app/_layout.tsx` (add `<Stack.Screen name="guide" options={{ presentation: "fullScreenModal", headerShown: false }} />` before `lock`, so the lock screen still presents above it)
- Modify: `src/app/(tabs)/settings.tsx`
- Test: `src/app/(tabs)/settings.test.tsx` (create if none exists; mock as in `OnboardingFlow.test.tsx`), `src/app/guide.test.tsx`

**Interfaces:**
- Consumes: `GuideFlow` (Task 4); `InfoButton` and `InfoText` (Task 3).
- Produces: the route `/guide`.

Behaviour:
- `guide.tsx`: on mount, `prefs.set("guideSeen", true)`. Renders `<GuideFlow mode="replay" onClose={() => router.back()} />`.
- `Row` gets an optional `info?: InfoTopic` prop. It renders an `InfoButton` between the label and the value. The row itself stays one Card press target and the button is its own target.
- `info` goes on the Home currency, Tax year starts in and Pay cycle starts on rows.
- The "Lock after" caption gets an `InfoButton topic="lockAfter"` beside it.
- The pay cycle `PickerSheet` replaces the `settings.monthStartHelp` text with `<InfoText topic="payCycle" showSummary />`. Delete the `settings.monthStartHelp` key in all 4 locales.
- A new `GroupTitle` `settings.help` above Support, with the row `settings.showGuide` → `router.push("/guide")`.

- [ ] **Step 1: Write the failing tests**
  - `"Show guide opens /guide"`
  - `"pay cycle row reads 'Pay cycle starts on'"`
  - `"tax year (i) opens the Tax year sheet"`
  - `"/guide marks guideSeen"`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`, `npm run lint` and `npm run typecheck`. Expected: all clean.
- [ ] **Step 5: Commit**: `feat(settings): Show guide, (i) explanations, pay cycle wording`

---

### Task 7: (i) on Stats and Search

**Files:**
- Modify: `src/stats/StatsScreen.tsx` (the pace line near `testID="stats-pace"` ~line 314; the unconverted section heading ~line 437), `src/search/FilterSheet.tsx` (the `search.unconverted` `OptionRow` ~line 128)
- Test: `src/stats/StatsScreen.test.tsx`, `src/search/FilterSheet.test.tsx` (extend the existing files, or create one if missing)

**Interfaces:**
- Consumes: `InfoButton` (Task 3).

Behaviour:
- The pace line becomes a row: the existing `Text` (flex 1) plus `<InfoButton topic="pace" />`. It renders only when the pace line renders.
- The Stats "Not converted" heading row gets `<InfoButton topic="unconverted" />`.
- In FilterSheet, wrap the unconverted `OptionRow` in a row with `<InfoButton topic="unconverted" />` after it. The checkbox's target stays unchanged.
- Not on the Home slip (spec 6.4).

- [ ] **Step 1: Write the failing tests**
  - `"pace (i) opens the Pace sheet"`
  - `"unconverted card (i) opens the Not converted sheet"`
  - `"filter sheet unconverted (i) does not toggle the filter"`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(stats,search): explain pace and not converted`

---

### Task 8: Home bar for existing users

**Files:**
- Create: `src/guide/GuideBar.tsx`
- Modify: `src/app/(tabs)/index.tsx` (render `<GuideBar />` right after `<BackupReminder />`, ~line 79)
- Test: `src/guide/GuideBar.test.tsx`

**Interfaces:**
- Consumes: `shouldRemindBackup`, from `src/backup/reminder.ts`; `guideSeen` (Task 1).
- Produces:
  - `shouldShowGuideBar(p: { onboardingStep: OnboardingStep; guideSeen: boolean; backupDue: boolean }): boolean`: true only when `onboardingStep === "done" && !guideSeen && !backupDue`.
  - `GuideBar()`: same container style as `BackupReminder`; text `guide.bar.text`; quiet buttons `guide.bar.open` (→ `router.push("/guide")`) and `guide.bar.dismiss`. Both buttons set `guideSeen = true`.

- [ ] **Step 1: Write the failing tests**
  - `shouldShowGuideBar` truth table:
    - done, unseen, no backup → true
    - seen → false
    - not done → false
    - backup due → false
  - `"Dismiss sets guideSeen and hides the bar"`
  - `"Show guide navigates to /guide"`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`, `npm run lint` and `npm run typecheck`. Expected: all clean.
- [ ] **Step 5: Commit**: `feat(home): one-time guide bar for existing users`

---

### Task 9: Device verification (Android → iPhone Duo → iPhone 18)

**Files:**
- Create: `docs/guide-acceptance.md`, `docs/guide-evidence/*.png`

Before each device: Metro runs from `apps/mobile` (`npx expo start --dev-client`). The JS-only change needs no rebuild. Use the existing dev builds.

- [ ] **Step 1: Android** (physical, via the owner's device hub).
  1. Clear app data to get a fresh first run.
  2. Walk all 5 steps and the 3 cards.
  3. Check that the pay cycle example changes with the day picked.
  4. Check Back, and kill and relaunch mid-step (it resumes).
  5. Settings → Show guide → Close.
  6. Open every (i): 4 in Settings, 2 in Stats, 1 in Search.
  7. Check dark mode, and both gesture and 3-button nav (nothing under the system bar).
  8. Upgrade path: set `onboardingStep = "done"` and `guideSeen = false` through the dev seed or a reinstall over an older build. The Home bar shows, and Dismiss hides it for good.
  9. Screenshot each state.
- [ ] **Step 2: iPhone Duo** (simulator).
  1. Outer screen upright: column.
  2. Outer sideways: short mode, footer pinned.
  3. Inner landscape: split, with the gutter on the fold at x ≈ 475.
  4. Inner portrait: column.
  5. Unfold mid-step on currency (search text kept) and on pay cycle (selection kept).
  6. Open the (i) sheets on the inner screen.
  7. Screenshots.
- [ ] **Step 3: iPhone 18** (simulator).
  1. Full first run and replay.
  2. Every (i).
  3. Dynamic Type at the largest standard size: no clipped text, buttons reachable.
  4. Screenshots.
- [ ] **Step 3b: Back button sweep** on every device: Stats, Categories, Recurring (list + one-pane form), Folder, Tax year, Export, Backup, Tip jar, Error log, Receipt. Same chevron, same place, same size.
- [ ] **Step 4:** Write `docs/guide-acceptance.md`. Use a table with rows per check × device and columns pass/fail/notes, plus links to the evidence. Fix any failure in its owning task's files, with a test, before marking it pass.
- [ ] **Step 5: Commit**: `docs(guide): device acceptance on Android, iPhone Duo, iPhone 18`. Then push to `main`.
