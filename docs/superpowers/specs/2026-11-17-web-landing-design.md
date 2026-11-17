# Website: landing page, privacy policy and terms

Date: 2026-11-17. Status: design by the web lead; owner decisions below are fixed.
Plan: `docs/superpowers/plans/2026-11-17-web-landing.md`. Code: `apps/web`.

## Intent

Give My Expenses Book a public home at `https://meb.terhubung.app` before the store release: one page that
says what the app is, and the two legal pages the stores require. The site must behave like the app: it
collects nothing and calls nobody.

## Owner decisions (fixed)

- Next.js App Router (16.4.x) in `apps/web`, self-contained (own `package.json` and lockfile). Node 26.
- Hosted on Vercel at `meb.terhubung.app`, as a fully static export (`output: "export"`).
- No analytics, no cookies, no third-party request at runtime. Fonts are bundled by `next/font` at build time.
- English only. Pages: `/`, `/privacy`, `/terms`.
- Legal party: PT Terhubung Lebih Lagi, Indonesia. Terms governed by the laws of the Republic of Indonesia.
- Contact: halo@terhubung.app.
- Store buttons say "Coming soon" and are visibly disabled until launch. The links live in one constant
  (`STORE_LINKS` in `src/config/site.ts`). No waitlist, no email collection.
- Visuals are real app screenshots, captured later. Marked placeholders until then.

## Goals

1. A landing page that explains the app in plain words: what it does, how it works, what leaves the phone,
   who it is for, and that it is free with an optional tip jar.
2. `/privacy` with the same facts as `docs/store/privacy-answers.md` and `site/privacy/index.html`, plus a
   section about the website itself.
3. `/terms`: Terms of use for a free app with optional consumable tips. **Draft: the owner should have it
   reviewed before release.**
4. The Ledger slip identity from the app, carried to the web without new colours.

## Non-goals

- Other languages, a blog, a changelog, a press kit, a waitlist, a contact form, a cookie banner (none needed).
- A theme toggle. The site follows `prefers-color-scheme` only, so it needs no script and no storage.
- Client-side JavaScript features. Every component is a Server Component; there is no `"use client"` file.
- Editing `apps/mobile` or `site/privacy/index.html`.

## Anti-goals

- Any request to another origin at runtime (fonts, scripts, images, embeds, analytics).
- An invented feature, number, review or user count. Every claim must be true of the app as built.
- Text contrast under 4.5:1, in light or dark. Yellow text on a light background.
- A screenshot that shows real receipts. Synthetic seed data only.

## Design plan

### Subject

The app is a book of receipts, and its one loud element is the home total printed on a green till slip with
a torn edge. The site uses the same idea: **each page opens as a green slip**, and the landing page's privacy
promise is printed as a **till receipt whose every line is 0**. Those two are the memorable parts. The rest
is quiet: ink on paper-grey, hairlines, and real screenshots.

### Colour

The app palette, unchanged (`apps/mobile/src/theme/tokens.ts`), light and dark. Source of truth for the web:
`apps/web/src/theme/tokens.ts`; `globals.css` declares the same values as `--color-*`, and a test fails on drift.

| Token | Light | Dark | Web use |
|---|---|---|---|
| background | #F2F5F1 | #0E1513 | page |
| surface | #FFFFFF | #17211E | the paper receipt |
| text | #16201C | #EEF3F0 | body text |
| textMuted | #56635D | #93A39C | secondary text |
| border | #DCE5DF | #26332E | hairlines |
| primary | #1F5C4C | #74C9AE | links, step numbers, footer brand |
| onPrimary | #FFFFFF | #06241B | text on primary |
| tonal | #E3EEE8 | #1E3A32 | audience band, screenshot placeholder |
| slip | #1F5C4C | #163F34 | header and page slip |
| slipText | #FFFFFF | #EEF3F0 | text on the slip |
| slipMuted | #BFD9CF | #BFD9CF | secondary text and disabled badges on the slip |
| highlight | #FFD84A | #FFD84A | the "total bar" and focus ring on the slip; the tip note fill |
| onHighlight | #16201C | #16201C | ink on a yellow fill |
| frame (web only) | #16201C | #26332E | phone frame around screenshots |

Yellow rules (from the brand spec): yellow marks appear only on the green slip. A yellow **fill** with ink
text is allowed for one "support the app" accent: the tip note. Never yellow text on a light background.

Elevation: one shadow, `--shadow-raised` (the app's green-tinted `raised`), used only on the phone frame.

### Type

- **Display: Bricolage Grotesque** 700 and 800 (`next/font/google`, latin subset, self-hosted at build).
  Used for h1 to h3, the brand name, step numbers and receipt figures.
- **Body: the system UI face**, as in the app ("body stays the system font"). No second web font.
- Figures in the receipt use tabular numerals.

| Role | Size | Weight | Line height | Tracking |
|---|---|---|---|---|
| h1 (display) | clamp(2.5rem, 1.55rem + 4.4vw, 4.5rem) | 800 | 1.02 | -0.02em |
| h2 | clamp(1.75rem, 1.4rem + 1.6vw, 2.5rem) | 700 | 1.1 | -0.01em |
| h3 | 1.25rem | 700 | 1.25 | 0 |
| lead | clamp(1.125rem, 1.07rem + 0.25vw, 1.25rem) | 400 | 1.5 | 0 |
| body | 1rem | 400 | 1.6 | 0 |
| small | 0.875rem | 400 | 1.45 | 0 |

Sentence case everywhere. No all-caps labels, no eyebrow labels above headings. Body measure at most 68
characters (`--measure: 680px` on legal pages).

### Layout

Mobile-first, left-aligned throughout (a receipt is read from its left edge). One container: 1120px max,
20px gutter (32px from 768px). Space scale: 4, 8, 12, 16, 24, 32, 48, 72, 112. Radius: 14px controls, pill.

Landing, mobile (360 to 899px):

```
+------------------------------+
| [icon] My Expenses Book  P T |  header, slip green
| Scan a receipt. Keep the     |  h1
| record, not the paper.       |
| ----  (yellow total bar)     |
| lead paragraph               |
| [Coming soon ] [Coming soon ]|  disabled badges, dashed outline
| [App Store   ] [Google Play ]|
| small note                   |
|        +----------+          |
|        |  phone:  |          |  home-slip screenshot
vvvvvvvvv|  home    |vvvvvvvvvv|  torn edge; the phone hangs over it
|        +----------+          |
| Three steps from paper ...   |  h2
| [phone] 1 Scan    text       |  ol, stacked
| [phone] 2 Review  text       |
| [phone] 3 Book    text       |
| What leaves your phone       |  h2 + body
| +--------------------+       |
| | Sent to us         |       |  paper receipt, tilted -1.5deg
| | Receipt photos ..0 |       |
| | ...              0 |       |
| | Total            0 |       |
| vvvvvvvvvvvvvvvvvvvvvv       |
| The app goes online for ...  |  h3 + ol (3) + link to /privacy
| What the book does           |  h2
| feature rows (hairlines)     |  dl, 1 column
| [phone: statistics]          |
|##############################|
| Who keeps a book like this   |  tonal band, 3 text blocks stacked
|##############################|
| Free, with a tip jar         |  h2, body, yellow note
| [phone: tip jar]             |
| footer: brand, legal links   |
+------------------------------+
```

Landing, desktop (900px and up):

```
+------------------------------------------------------------------+
| [icon] My Expenses Book                           Privacy  Terms |
| Scan a receipt.                               +-----------+      |
| Keep the record,                              |  phone    |      |
| not the paper.                                |  home     |      |
| ----                                          |  slip     |      |
| lead (max 34rem)                              |           |      |
| [Coming soon / App Store] [Coming soon / Google Play]     |      |
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv|           |vvvvvv|
|                                               +-----------+      |
| Three steps from paper to record                                 |
| [phone] 1 Scan      [phone] 2 Review     [phone] 3 Book          |
|                                                                  |
| What leaves your phone            +-------------------+          |
| body                              | Sent to us        |          |
| The app goes online for ...       | rows ......... 0  |          |
| 1. 2. 3.   Read the privacy policy| Total          0  |          |
|                                   vvvvvvvvvvvvvvvvvvvvv          |
| What the book does                                               |
| feature | feature                              [phone:           |
| feature | feature   (dl, 2 columns)             statistics]      |
|##################################################################|
| Who keeps a book like this                                       |
| Travellers ...      Freelancers ...      Households ...          |
|##################################################################|
| [phone: tip jar]    Free, with a tip jar / body / yellow note    |
| footer                                                           |
+------------------------------------------------------------------+
```

Legal pages (`/privacy`, `/terms`), all widths:

```
+------------------------------+
| header                       |
| Privacy policy               |  h1 on the slip
| ----                         |
| one-sentence summary         |
vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
| Effective 17 November 2026   |  small, muted
| intro                        |  one column, max 680px
| Heading                      |  h2 at 1.375rem
| paragraphs and lists         |
| footer                       |
+------------------------------+
```

### Motion

One moment only: on the landing page the hero phone "prints" out of the slip once on load (600ms,
`translateY(-24px)` and opacity 0 to rest). Nothing else animates; no scroll effects, no hover lifts.
`prefers-reduced-motion: reduce` removes it (global rule in `globals.css`).

### Review against the brief (second pass)

- First draft had the three steps as rounded cards with icons. That is the generic kit and says nothing
  about this app. Changed to a numbered list with real screenshots; the numbers stay because the content is
  a true sequence.
- First draft showed privacy as a row of "No account / No ads / No tracking" badges. Changed to the
  zero-total receipt, which only this product can use, and which sits next to the honest list of the three
  network uses (including the Android ML Kit diagnostics) instead of hiding them on the legal page.
- A second web font for body text was dropped: the app uses the system face for body, and it costs nothing.
- Official "Download on the App Store" / "Get it on Google Play" artwork is not used while the links are
  disabled: both brands forbid altered badges. The site draws its own neutral badge.
- Removed: a gradient behind the hero, a feature icon set, hover animations.

### Accessibility

- Every text pair is listed in `textPairs` (`src/theme/tokens.ts`) and tested at 4.5:1 or better in both
  schemes. New pair: add it to the list first.
- Visible focus: 3px outline, primary on paper, yellow on the slip. Skip link to `#content`.
- Touch targets at least 48px high for links in the header and footer.
- One `<h1>` per page (in the slip); sections use `<h2>`, items `<h3>`. Steps are an `<ol>`; the receipt and
  the feature list are `<dl>`.
- Disabled badges are text (`<span>`), not links and not focusable; their label reads "Coming soon, App Store".
- Screenshots have descriptive `alt`. Placeholders use `role="img"` with `aria-label="Screenshot placeholder: <screen>"`.
- Layout holds from 320px wide and at 200% zoom; no horizontal scroll.

## Copy

All landing copy is in `apps/web/src/content/landing.ts` and is reproduced here. Components contain no prose.

**Hero.** Title: "Scan a receipt. Keep the record, not the paper." Lead: "My Expenses Book reads the
merchant, date, total, tax and currency from a receipt, and you only confirm. Everything is stored on your
phone, encrypted. No account, no ads, no tracking." Badges: "Coming soon / App Store", "Coming soon / Google
Play" (after launch: "Download on / App Store", "Download on / Google Play"). Note: "Free. For iPhone, iPad
and Android phones, tablets and foldables. Requires iOS 16.4 or Android 8, or later."

**How it works.** Title: "Three steps from paper to record".
1. Scan: "Scan a paper receipt with the camera, or import photos and screenshots. A receipt with several
   pages stays together as one record."
2. Review: "The app fills in the merchant, date, total, tax, currency and category. A field it is unsure
   about is marked “Check this”. Nothing is saved until you confirm."
3. Book: "The receipt joins your book. It is grouped by month, added to the total in your home currency, and
   findable by merchant, note or any word printed on it."

**Privacy promise.** Title: "What leaves your phone". Body: "Your receipts are stored only on your device, in
an encrypted database with encrypted images. You can also lock the app with Face ID, fingerprint or your
device passcode." Receipt heading: "Sent to us". Rows, each with the figure 0: "Receipt photos", "Amounts,
dates and notes", "Accounts to sign up for", "Ads", "Analytics and crash reports". Total row: "Total", 0.
Network title: "The app goes online for three things".
1. "Exchange rates. It downloads public exchange-rate tables. The request holds a currency code and a date,
   and nothing about you."
2. "Tips. If you open the tip jar, the App Store or Google Play shows the prices and handles the payment."
3. "Android only: Google ML Kit. It reads receipts on your phone and sends Google its own diagnostics. It
   never sends your receipt images or text."
Link: "Read the privacy policy" to `/privacy`.

**Features.** Title: "What the book does".
- Many currencies: "Each receipt keeps its own currency. A foreign receipt is converted to your home currency
  at the rate of the purchase date, and you can enter your own rate."
- Folders and tax years: "Put receipts in folders for trips and projects. Tax-year views add up each year."
- Search: "Search merchants, notes and the text of the receipt itself, then narrow the results with filters."
- Statistics: "Compare this month with the last one, and see the last six months, your categories and your
  top merchants."
- Export: "Export a CSV file or a PDF report for expense claims and tax returns."
- Backup: "Save one backup file, protected by a passphrase, wherever you like. Restore it later or merge it
  into the receipts already on the phone."
- App lock: "Open the app with Face ID, fingerprint or your device passcode."
- Languages: "The app is in English, Indonesian, Spanish and Brazilian Portuguese, and it reads receipts in
  many more languages."

**Audiences.** Title: "Who keeps a book like this".
- Travellers and expense claimers: "Scan receipts in any currency as you go. Each one is converted at the
  rate of the day you paid. Put the trip in a folder and export a PDF report when you file the claim."
- Freelancers: "Keep business receipts through the year. The tax-year view gives you the totals and the CSV
  export gives your accountant the rows. The app keeps records; it does not give tax advice."
- Households: "See where the month went, by category and by merchant. When you need an old receipt for a
  warranty, search for the shop or the item."

**Tip jar.** Title: "Free, with a tip jar". Body: "My Expenses Book is free, with no ads and no tracking. If
it makes your receipts easier to deal with, you can buy the developer a coffee from the tip jar inside the
app." Note (yellow fill): "Tips are optional and unlock nothing. Every feature works with or without one."

**Footer.** "My Expenses Book", "Made by PT Terhubung Lebih Lagi, Indonesia.", links "Privacy policy",
"Terms of use", "halo@terhubung.app", and "This website uses no cookies and no analytics."

**Not found (404).** Title: "This page is not in the book". Lead: "The address may be mistyped, or the page
has moved." Link: "Go to the home page".

### Legal text

The full text is data, written by the lead and committed with the scaffold. These files are canonical:

- `apps/web/src/content/privacy.ts`. Sections: What stays on your device; Network connections the app makes
  (exchange rates from `cdn.jsdelivr.net`, tips through the App Store and Google Play, Android-only Google ML
  Kit diagnostics); Backups and exports; Deleting your data; Children; **This website** (no cookies, no
  analytics, nothing loaded from other servers, Vercel processes standard request logs, email only used to
  reply); Changes and contact. The app sections repeat the English body text of `site/privacy/index.html` word for
  word. Effective 2026-11-17.
- `apps/web/src/content/terms.ts`. **Draft, owner should have it reviewed.** Sections: 1 Your licence; 2 Your
  records are your responsibility (not financial or tax advice; exchange rates indicative); 3 Your data and
  backups; 4 Tips (voluntary, unlock nothing, refunds through Apple or Google); 5 Services from other
  companies; 6 Apple App Store terms (Apple's minimum EULA terms); 7 No warranty; 8 Limits on our liability
  (cap: tips of the last 12 months or IDR 100,000, whichever is larger); 9 Ending these terms; 10 Changes;
  11 Governing law (Republic of Indonesia); 12 Contact.

Strings in these files may use three inline marks only: `**bold**`, `` `code` ``, `[label](href)`.

## Screenshots

Captured by another agent or the owner from the iOS simulator. Rules: iPhone 16 Pro Max simulator, portrait,
**1320×2868 PNG**, light mode, English, synthetic seed data (`src/dev/seed.ts`), status bar at 9:41 with full
battery and no carrier text (`xcrun simctl status_bar ... override`).

| File (in `apps/web/screenshots-src/`) | Screen | Must show | Used in |
|---|---|---|---|
| `home-slip.png` | Home (Receipts tab) | the green slip with the month total and stats line, receipts below | hero |
| `capture.png` | Add a receipt sheet | Scan receipt, Import from Photos, Add manually | step 1 |
| `review.png` | Review receipt | all fields filled, one "Check this" mark | step 2 |
| `receipt-detail.png` | Receipt detail | a foreign-currency receipt: photo, converted amount, rate of the purchase date | step 3 |
| `statistics.png` | Statistics, Month | total, last six months bars, categories | features |
| `tip-jar.png` | Tip jar | the three coffees with prices | tip jar |

`capture.png` is the add sheet, not the camera: the document scanner does not run in the simulator.

Processing: `npm run screenshots` (a `sharp` script) writes `public/screenshots/<name>.webp` at **780×1695**,
quality 82. One size serves every density (shown at most 300 CSS px wide).

Frame treatment (CSS only, no device artwork): the image sits in a `frame`-coloured bezel, 8px padding, outer
radius 44px (36px for the small size), inner radius 36px (28px), `--shadow-raised`. Widths: 300px (`md`: hero,
features), 240px (`sm`: steps, tip jar), never wider than the column. Aspect ratio 780/1695.

Placeholder (until `ready: true` in `src/content/screenshots.ts`): the same frame, filled with `tonal` and
diagonal `border`-coloured hatching, with the text "Screenshot placeholder", the screen name and the file
name. It carries `data-placeholder="<id>"` so the launch check can refuse to pass while any remain.

## Architecture

- `output: "export"`; `next build` writes `out/`. Vercel serves it. `images.unoptimized: true`.
- No Tailwind. Reason: three static pages, a fixed token set that already exists as CSS variables, and a few
  bespoke shapes (torn edge, receipt, phone frame) that need hand-written CSS anyway. CSS Modules plus
  `globals.css` keep the dependency list short and make "use a token, never a raw hex" checkable by script.
- Structure: `src/config/site.ts` (facts, `STORE_LINKS`), `src/content/*` (all copy, legal data, screenshot
  manifest), `src/theme/tokens.ts` (palette, contrast maths), `src/components/*` (one component per file,
  with a `.module.css` beside it), `src/app/*` (routes, metadata, `robots.ts`, `sitemap.ts`).
- Tests: Vitest with Testing Library (jsdom) for tokens and components; a Node script checks the built `out/`
  for broken internal links, third-party resource URLs and leftover placeholders.
- Response headers (CSP that allows only this origin, no referrer, no sniffing) are set in `vercel.json`,
  because a static export cannot set headers itself.

## Launch checklist (owner)

1. Have `/terms` reviewed. It is a draft.
2. Capture the six screenshots, run `npm run screenshots`, set `ready: true`.
3. Deploy to Vercel (root directory `apps/web`), add the domain, set the DNS CNAME. See `apps/web/DEPLOY.md`.
4. In the app, `PRIVACY_POLICY_URL` (`apps/mobile/src/about/links.ts`) becomes
   `https://meb.terhubung.app/privacy`. This is mobile work, outside this plan. `site/privacy/index.html` is
   superseded and stays in place.
5. At store launch, put the listing URLs in `STORE_LINKS`.

## Open questions for the owner

1. Apple's minimum EULA terms ask for the developer's name **and address**. The Terms give the company name,
   country and email only. Add the registered address?
2. The liability cap (tips in the last 12 months, or IDR 100,000) and the "courts of the Republic of
   Indonesia" venue are the lead's defaults. Confirm with the reviewer; a named court or BANI arbitration are
   the usual alternatives.
3. At launch: keep the site's own neutral store buttons, or switch to the official Apple and Google badges
   (each has artwork rules)?
4. The Languages feature names Spanish and Brazilian Portuguese because the app ships those locales. If the
   slip policy cuts them from v1, remove them from `features` in `landing.ts`.
