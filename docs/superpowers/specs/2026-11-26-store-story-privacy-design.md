# Store screenshots: privacy story (design)

Date: 2026-11-26. Size: small change. Status: approved 2026-11-26.

## Intent

The current set (7 slides, 4 languages) is well made but does not show the app's main reason to exist:
your receipts stay on your phone. The first users we are betting on are:

- people who care about privacy and are leaving cloud expense apps,
- people who want a free app,
- older people who want a simple app that works on their phone.

The set should tell one story: **simple, free, and it stays on your phone.** Captions use plain words
and the search terms people type (receipt, scan, expense, spending, travel).

## Goals

- Add a privacy slide that shows where the data lives.
- Make the scan slide show the "it reads the total" moment.
- Rewrite the captions in plain language, with search terms, in all 4 languages.
- Reorder the slides so the first three (what search results show) are Free, Private, Scan.

## Non-goals

- No new app captures. Every app slide is built from the existing `store/screenshots/raw/`.
- No zoom or crop pass for readability (approach C). That can be an A/B test after launch.
- No change to the website screenshots (`apps/web`).

## Anti-goals

- A privacy claim the app does not keep. Every line on the privacy slide must be true on both platforms.
- A slide that looks different from the rest of the set. The privacy slide uses the same receipt style as `00-free`.

## Approaches

- **A. Captions and order only.** Cheapest, but privacy is still not shown.
- **B. Two designed slides, a fixed scan slide and plain captions.** Chosen: it closes the privacy gap with
  no device work and reuses the receipt slide that already works.
- **C. Everything in B plus a 1.3× zoom of every app shot and new captures of lock, backup and export.**
  Strongest for older users, but it needs new sessions on every device. Kept for later.

## Design

### Slide order (8 slides: the Play maximum)

| # | File | Source | Caption (EN) |
|---|---|---|---|
| 1 | `00-free` | `promo.swift`, `zero-receipt.json` (unchanged) | Free. No ads. Works offline. |
| 2 | `01-private` | `promo.swift`, new `private-receipt.json` | Your receipts stay on your phone. |
| 3 | `02-scan` | raw `01-review` + yellow marker | Scan a receipt. The total fills in. |
| 4 | `03-month` | raw `02-home` | Your monthly spending at a glance. |
| 5 | `04-readable` | raw `03-zoom` | Every receipt photo, sharp and readable. |
| 6 | `05-stats` | raw `04-stats` | See where your money goes. |
| 7 | `06-search` | raw `06-search` | Find any receipt in seconds. |
| 8 | `07-trips` | raw `05-trip` | Travel and projects, in any currency. |

The ID, ES and PT-BR captions are rewritten in the same plain style. The ES and PT-BR versions join the
native-speaker review that is already on the submission checklist.

### Privacy slide (`01-private`)

The same paper receipt as `00-free`, drawn by `promo.swift` from a new JSON file. EN content:

```
YOUR RECEIPTS

Stored on         this phone
Cloud upload      0
Data sent to us   0
Encrypted         yes
App lock          yes
Backup            your own file

TOTAL       ONLY ON YOUR PHONE
```

Each line is true on iOS and Android: the database and images are encrypted, the lock supports
Face ID, fingerprint or passcode, and backup is a file the user keeps. The only network use is the
exchange-rate tables, which carry no user data. "App lock" stays platform-neutral because the same
slide is used on both stores.

### Scan slide (`02-scan`)

`frame.swift` gets an optional overlay: a yellow marker on the receipt's TOTAL line and on the Total
field, joined so the eye goes from one to the other. The rectangles come from a small per-device,
per-language JSON file, measured once on each `raw/<device>/<lang>/01-review.png` (16 files).

The category chips cut off behind the Save bar are part of the raw capture. They stay as they are; the
marker moves attention to the Total field. Fixing the chips would need a new capture.

### Feature graphic

Proposal: change the tagline to "Free. Private. No ads." so the first thing Play shows carries the
privacy point too. Same layout.

### Docs

Update `docs/store/submit-screenshots-and-languages.md` for the new file names and order.

## Left to the builder

- The exact marker shape (highlight bar or outline) and how the two marks are joined, as long as they
  match the yellow bar already used under the captions.
- The ID, ES and PT-BR captions and the privacy-receipt lines, in the plain style above.
