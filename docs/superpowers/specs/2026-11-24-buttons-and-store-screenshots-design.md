# Buttons without links, and store screenshots

Date: 2026-11-24. Status: approved by the owner (2026-11-24).

## Intent

The owner does not like text-link buttons (underlined text). Every button should look like a button.
Yellow is used on one or two kinds of button. The app also needs App Store and Play Store screenshots.
The old screenshot cleanup was dropped ("no need").

## Decisions

### Buttons (owner)

- The `quiet` variant of `src/components/Button.tsx` becomes an **outline button**: a transparent fill, a
  1 pt border, coloured text, and the same height, padding and corner radius as the other buttons. The
  underline is removed.
  - Tones: default uses green text with a green border at low strength, danger uses red, and muted uses
    the grey text and the grey border.
  - Pressed: a light tint fill.
  - It covers the ~35 existing uses, such as Cancel, Periksa nanti, Tutup and Nanti.
- The underlined "Lihat struk" text link in `src/stats/StatsScreen.tsx` becomes an outline button.
- **Yellow** (the existing `highlight` variant) is used for the action buttons in Home nudges only:
  - the guide bar's "Tampilkan panduan"
  - the backup reminder's main action
  - the recurring catch-up banner's main action

  Green stays the main action everywhere else.

### Store screenshots (owner: framed + captions, English and Bahasa Indonesia)

- There are 6 shots. The frame is a torn slip:
  - A slip-green (`#1F5C4C`) header holds the caption in Bricolage Grotesque ExtraBold, left aligned.
  - A 4 pt yellow (`#FFD84A`) bar sits under the caption, the same mark as under the month total.
  - The header ends in the app's torn bottom edge, in page colour (`#F2F5F1`).
  - Below it, the real screen sits in a frameless rounded rectangle with no fake device chrome, and runs
    off the bottom edge.
  - One caption only: no subtitle, no badges.
- The shots are taken from demo data, never the owner's own receipts.
- Sizes:

  | Store | Device | Size (px) |
  |---|---|---|
  | App Store | iPhone 6.9" | 1320×2868 |
  | App Store | iPad 13" (the app supports tablets) | 2064×2752 |
  | Play Store | phone | 1080×2160 |

- Output goes to `store/screenshots/<store>/<lang>/NN-name.png`, with the generator script next to it.
- Proposed shots (caption EN / ID):
  1. Review after a scan: "Snap a receipt. It reads the total." / "Foto struk. Totalnya terbaca otomatis."
  2. Home with totals: "Know this month at a glance." / "Lihat pengeluaran bulan ini sekilas."
  3. Receipt photo, zoomed: "Every receipt, readable." / "Setiap struk, jelas terbaca."
  4. Statistics: "See where it goes." / "Lihat ke mana uangmu pergi."
  5. Trip folder in a foreign currency: "Trips and projects, any currency." / "Perjalanan dan proyek, mata uang apa pun."
  6. Lock / private: "Private. Stays on your phone." / "Privat. Tetap di HP-mu."

## Checks

- Unit tests for the new Button styles.
- Full suite, tsc and lint.
- Device pass in this order: Redmi, iPhone Duo simulator, iPhone 18 simulator.

## Non-goals

Deleting old screenshots. New screens. Changes to icons, the app name or store text.
