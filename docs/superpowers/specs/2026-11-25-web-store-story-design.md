# Website: store-listing story and iPhone Duo

Date: 2026-11-25. Status: owner chose approach A; short design. Builds on
`2026-11-17-web-landing-design.md`; everything there still holds unless changed here.

## Intent

Launch prep. The landing page at meb.terhubung.app should tell the same story, with the same screenshots, as
the App Store and Play listing, and show the iPhone Duo foldable that the copy already claims.

## Goals

- The landing page follows the six store scenes in store order (`store/screenshots/captions.json`, English).
- Screenshots come from the 2026-11-24 store run (`store/screenshots/raw/`), not the 2026-11-17 captures.
- One "Fits your screen" band shows the Duo folded (outer) and unfolded (inner) side by side.

## Non-goals

- Other languages on the site (still English only).
- New colours, fonts or a theme toggle. Privacy, terms and the 404 page stay as they are.

## Anti-goals

- Any claim not true of the app as built. The same no-third-party, no-JS, 4.5:1 contrast rules as before.

## Approaches

- **A. Six-scene story (picked).** Page sections follow the store scenes. Matches the listing one to one.
- B. Swap images into the current slots and add a Duo band. Small diff, but does not match the store story.
- C. Scenes rotate device types. Shows every form factor but reads noisy and crowds phones.

## Page order

1. Hero slip: h1 unchanged ("Scan a receipt. Keep the record, not the paper."), lead, badges, note. The phone
   shows `01-review` (store scene 1). *My call:* the h1 stays because it is the brand promise. Caption 1
   ("Snap a receipt. It reads the total.") is not printed; the review screen says it.
2. Story: one h2 "How the book works" and five scenes, each an h3 with the store caption, one or two
   sentences of plain body copy, and the iPhone shot. Alternate sides from 900px; stacked on mobile.
   - `02-home` "Know this month at a glance."
   - `03-zoom` "Every receipt, readable."
   - `04-stats` "See where it goes."
   - `05-trip` "Trips and projects, any currency."
   - `06-search` "Find any receipt in seconds."
3. Fits your screen: Duo outer (`02-home`) and Duo inner (`02-home`) side by side, one line on iPad and Android
   tablets and foldables. Duo inner sits in a wider frame (2007x2853), outer in a narrow one (1398x2034).
4. What leaves your phone: zero receipt, unchanged.
5. What else the book does: the old feature list, minus items the scenes now cover (Statistics, Search,
   Many currencies are folded into scene copy); no screenshot.
6. Who keeps a book like this: unchanged.
7. Free, with a tip jar: text only. The tip-jar screenshot slot is removed (no store shot exists).

Removed: "Three steps" section and the `capture`, `receipt-detail`, `home-slip`, `statistics`, `tip-jar`
shots.

## Build notes (left to the builder)

- `PhoneShot` gains a device variant (`iphone`, `duo-outer`, `duo-inner`) with per-device aspect ratio and
  corner radius; shots table records width and height per image.
- `prepare-screenshots.mjs` reads from `store/screenshots/raw/<device>/en/` and writes webp at a size that
  keeps the source aspect (iPhone 780 wide; Duo inner about 900 wide; Duo outer about 560 wide), quality 82.
- Update `page.test.tsx`, `PhoneShot.test.tsx`, `screenshots-src/README.md`, and the alt text for every shot.
- Verify with `npm run check` and a look in the browser at 375px and 1280px, light and dark.
