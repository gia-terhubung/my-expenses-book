# Store screenshots: "Sunshine" redesign (design)

Date: 2026-11-27. Status: draft, awaiting owner approval. Builder check done; owner answered its questions.

## Intent

The store screenshots get a fresher look for the **same** buyers: privacy-minded people leaving cloud
apps, people who want a free app, and older people who want a simple app (owner, 2026-11-27: "same
people, just a fresher look"). The current set shows the old navigation, so every screen must be
recaptured anyway: the app now uses Apple's native tabs and headers on iOS.

## Goals

- Every store set rebuilt in the "A · Sunshine" style the owner picked from the mockups
  (`.superpowers/brainstorm/83033-1795754431/content/style.html`):
  - all-yellow page (`#FFD84A`, the app's highlight yellow);
  - caption in brand green (`#1F5C4C`), Bricolage Grotesque 800, top-left;
  - the device tipped slightly (about −4°);
  - a green band along the bottom with the app's torn-receipt (zigzag) edge.
- Each set framed in **its own device's shape**: Android phone (punch-hole camera), iPhone (Dynamic
  Island), iPhone Duo closed (with its spine), iPhone Duo open (with the centre fold), iPad (even bezel).
- **Duo open: both orientations** (owner, 2026-11-27). The upright set (2007 × 2853) is the one for
  the App Store's Duo slot, because nobody could confirm the slot takes a sideways image. A sideways set
  (2853 × 2007, list and receipt side by side) is made too, for the slot if it turns out to accept it,
  and for the website.
- **Play phone captured on the Redmi**, not reused from the iPhone (today's Play phone images are
  iPhone captures).
- Same 8 slides, same order, same captions in en, id, es, pt-BR:
  00-free, 01-private, 02-scan, 03-month, 04-readable, 05-stats, 06-search, 07-trips. The caption
  text in `store/screenshots/captions.json` stays as it is.
- Play feature graphic (1024 × 500, one per language): today's layout (app icon, name, tilted receipt)
  recoloured to yellow with the green receipt band, and **new copy that says what the app is**
  (owner, 2026-11-27). Proposed copy (builder's call; native-speaker review still open for es/pt-BR):
  - en: "Scan receipts and see where your money goes. Free, private, no ads."
  - id: "Pindai struk dan lihat ke mana uangmu pergi. Gratis, privat, tanpa iklan."
  - es: "Escanea tickets y mira en qué se va tu dinero. Gratis, privada, sin anuncios."
  - pt-BR: "Escaneie recibos e veja para onde vai seu dinheiro. Grátis, privado, sem anúncios."


## Non-goals

- New captions, new slides or a new slide order.
- The website's screenshots (`site/`), which still use the old copy.
- Native-speaker review of es and pt-BR (still open from 2026-11-24).
- Android tablet capture: Play tablet keeps using the iPad captures (no Android tablet available),
  shown in a **plain tablet frame** with no brand details (owner, 2026-11-27), not an iPad frame.

## Anti-goals

- Anything that makes the text harder to read for older users: the caption must stay large, dark
  green on yellow, no thin or light type, no low-contrast text.
- A device frame that does not match the store slot's device (an iPhone frame on the Play set, a
  plain phone frame on the Duo sets).
- Images that fail the store's exact size or have an alpha channel (`tools/check.sh` checks both).
- Captured screens showing real data: only the seeded demo receipts.

## Constraints

- Store sizes (unchanged unless noted):

  | Set | Size (px) | Capture device |
  |---|---|---|
  | App Store iPhone 6.9" | 1320 × 2868 | iPhone 18 Pro Max sim |
  | App Store iPad 13" | 2064 × 2752 | iPad Pro 13" (M5) sim |
  | App Store Duo outer | 1398 × 2034 | iPhone Duo sim `06C208F7…`, closed |
  | App Store Duo inner | 2007 × 2853 (upright, unchanged) | iPhone Duo sim, open, upright |
  | Duo inner sideways (extra set) | 2853 × 2007 | iPhone Duo sim, open, held sideways |
  | Play phone | 1080 × 1920 | Redmi (2409BRN2CY, 720 × 1640 screen) |
  | Play tablet | 1440 × 2560 | iPad captures |
  | Play feature | 1024 × 500 | none (drawn) |

- The Redmi screen is 720 × 1640. In a 1080 × 1920 slide the phone frame is drawn so the screen
  lands at about its native width; captures are never scaled up more than 1.1×.
- Captures come from the dev build with the seeded store data (`src/dev/screens/StoreShots.tsx`,
  deep link `myexpensesbook://dev/store-shots?...`). The seed refuses to run on a database with real
  receipts, so every capture device starts with its app data wiped (iOS: the e2e wipe with backup;
  Redmi: the owner approved wiping its app data with `pm clear`, 2026-11-27).
- **Capture from the final navigation** (builder's call): capture starts after the native-navigation
  plan (`docs/superpowers/plans/2026-11-27-native-navigation-implementation.md`) is merged, which needs
  the `ROUTE_NAMES_CHANGED` dev error fixed and the Duo e2e passing.
- Capture order (owner): Redmi → Duo (after its test pass, then shut it down) → iPad → iPhone 18 Pro
  Max. One simulator booted at a time.
- No new npm or Homebrew dependencies: Chrome's own headless screenshot mode renders the pages.

## Approaches

| | How | Trade-off | |
|---|---|---|---|
| 1 | One HTML/CSS template per slide size, rendered to PNG by headless Chrome | The approved mockup is the template; quick to change; needs a final pass to strip alpha and hit exact sizes | **chosen** (owner) |
| 2 | Extend `tools/frame.swift` (CoreGraphics) | No new tooling, but each frame shape drawn by hand in Swift; slow to iterate and hard to keep matching the mockup | not chosen |

## The design as decided

- **Template**: one HTML page parameterised by query string (`device`, `lang`, `slide`, size). It
  loads the raw capture, the caption from `captions.json`, the Bricolage font from the app's
  `node_modules`, and draws the frame for `device` in CSS.
- **Render**: `tools/render-html.sh` runs Chrome headless with `--screenshot --window-size=W,H` per
  slide and language, then `sips` flattens to no alpha and checks the size. Output goes to the same
  `out/` folders (git-ignored), so `docs/store/submit-screenshots-and-languages.md` stays valid; the
  sideways Duo set goes to `out/appstore/duo-inner-sideways/` and gets a line in that doc.
- **00-free and 01-private** (the drawn receipts, no capture): rebuilt in the same template as a
  receipt card instead of a phone, from `zero-receipt.json` and `private-receipt.json`.
- **02-scan marks** (the yellow TOTAL-to-field highlight) keep their positions from `marks.json`,
  remeasured on the new captures.
- **Capture**:
  - iOS: `tools/capture-ios.sh` as today, with the new screens; the Duo open is captured upright and
    sideways.
  - Android: new `tools/capture-android.sh` using `adb` (deep link, `screencap`), same 6 screens.
- `tools/check.sh` updated for the sideways Duo set and the Play phone source.
- **Frames per set**: Play phone → Android phone frame; iPhone → iPhone frame; Duo outer → Duo closed;
  Duo inner (both orientations) → Duo open with its centre fold; iPad → iPad frame; Play tablet →
  plain tablet frame.

## Left to the builder

- Exact frame dimensions, corner radii and tilt per device, matched to the mockup's proportions.
- Where the caption wraps per language (the pt-BR 02-scan caption already wraps to 3 lines on the
  upright Duo; sideways it has more room).
- How the receipt-card slides (00, 01) sit on the yellow page.
