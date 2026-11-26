# Adding languages and screenshots in App Store Connect and Play Console

Written 2026-11-24. Covers the four store languages: English (default), Bahasa Indonesia,
Español (España) and Português (Brasil). Do this when you submit; nothing here is uploaded yet.

## What you have

| Where | What |
|---|---|
| `apps/mobile/store.config.json` | App Store text per language: title, subtitle, description, keywords, privacy and support URLs |
| `docs/store/play-listing.md` | Play text per language: app name, short and full description |
| `store/screenshots/out/appstore/iphone-6.9/<lang>/` | iPhone 6.9" screenshots, 1320 × 2868 |
| `store/screenshots/out/appstore/ipad-13/<lang>/` | iPad 13" screenshots, 2064 × 2752 |
| `store/screenshots/out/appstore/duo-outer/<lang>/` | iPhone Duo outer display, 1398 × 2034 |
| `store/screenshots/out/appstore/duo-inner/<lang>/` | iPhone Duo inner display, 2007 × 2853 |
| `store/screenshots/out/play/phone/<lang>/` | Play phone screenshots, 1080 × 1920 |
| `store/screenshots/out/play/tablet/<lang>/` | Play 7" and 10" tablet screenshots, 1440 × 2560 |
| `store/screenshots/out/play/feature/<lang>.png` | Play feature graphic, 1024 × 500, one per language |

`<lang>` is `en`, `id`, `es` or `pt-BR`. Each folder has seven files, `00-free` to `06-search`.
Upload them in that order: the first three are what people see in search results. `00-free` is the
"zero receipt" (free, no ads, works offline) and always goes first.

The `out/` folders are not in git: they are rebuilt by `store/screenshots/tools/render.sh`. If
they are missing, see "Rebuilding the screenshots" at the end.

## App Store Connect

Store language to App Store localization:

| Folder | App Store Connect language |
|---|---|
| `en` | English (U.S.) (primary) |
| `id` | Indonesian |
| `es` | Spanish (Spain) |
| `pt-BR` | Portuguese (Brazil) |

### 1. Add the languages (once)

1. Open App Store Connect → **Apps** → My Expenses Book.
2. Choose the version you are preparing (left sidebar, under **iOS App**).
3. At the top right of the page, open the language menu (it shows **English (U.S.)**).
4. Choose **Add Language…**, pick **Indonesian**, then confirm.
5. Repeat for **Spanish (Spain)** and **Portuguese (Brazil)**.

### 2. Fill in the text for each language

For each language, select it in the language menu, then copy the values from
`apps/mobile/store.config.json` (the block named `id`, `es-ES` or `pt-BR`):

1. On the version page: **Description**, **Keywords** (join the list with commas, no spaces after
   the commas), **Support URL**.
2. In the sidebar, open **App Information**. With the same language selected, fill in **Name** and
   **Subtitle**.
3. In the sidebar, open **App Privacy**. Set the **Privacy Policy URL** (the same for every
   language): `https://meb.terhubung.app/privacy`.

Alternative for the text only: `npx eas-cli@latest metadata:push` from `apps/mobile` uploads
`store.config.json` for every language at once. Screenshots still go in by hand.

### 3. Upload the screenshots for each language

1. Select the language in the language menu.
2. On the version page, scroll to **Previews and Screenshots**.
3. Upload each set by display size:
   - **iPhone 6.9" Display**: drag in the seven files from `appstore/iphone-6.9/<lang>/`.
     Apple scales these down for every smaller iPhone, so no other iPhone size is needed.
   - **iPad 13" Display**: the seven files from `appstore/ipad-13/<lang>/`.
   - **iPhone Duo**: the outer-display set from `appstore/duo-outer/<lang>/` and the
     inner-display set from `appstore/duo-inner/<lang>/`, each in its own slot.
4. Check the order after uploading: drag to reorder so that 00 comes first.
5. Click **Save** at the top right.

Repeat for the next language. A language without its own screenshots shows the English ones,
so upload all four.

## Google Play Console

Store language to Play language:

| Folder | Play Console language |
|---|---|
| `en` | English (United States) – en-US (default) |
| `id` | Indonesian – id |
| `es` | Spanish (Spain) – es-ES |
| `pt-BR` | Portuguese (Brazil) – pt-BR |

### 1. Default listing (English)

1. Open Play Console → My Expenses Book → **Grow users** → **Store presence** → **Store listings**.
2. Open the **Default store listing**.
3. **App details**: paste the English **App name**, **Short description** and
   **Full description** from `docs/store/play-listing.md`.
4. **Graphics**:
   - **App icon**: 512 × 512 PNG.
   - **Feature graphic**: `play/feature/en.png` (1024 × 500). Play needs it before you can publish.
   - **Phone screenshots**: the seven files from `play/phone/en/`.
   - **7-inch tablet screenshots** and **10-inch tablet screenshots**: the seven files from
     `play/tablet/en/` in each. At least four per tablet size is what Play asks for before it
     features the app on tablets.
5. Click **Save**.

### 2. Translations (Indonesian, Spanish, Portuguese)

1. On the same store listing page, choose **Manage translations** → **Add your own translations**.
2. Tick **Indonesian – id**, **Spanish (Spain) – es-ES** and **Portuguese (Brazil) – pt-BR**, then
   **Apply**.
3. Switch the language selector at the top of the listing to each new language and paste that
   language's name, short description and full description from `docs/store/play-listing.md`.
4. Still in that language, open **Graphics** and upload that language's feature graphic
   (`play/feature/<lang>.png`) and its phone and tablet screenshots (`play/phone/<lang>/` and
   `play/tablet/<lang>/`). Play otherwise shows the English ones to everyone.
5. Click **Save** after each language.

## Before you press submit

- Confirm a native speaker has read the Spanish and Portuguese text. It was written for Spain
  and Brazil (ticket, IVA, declaración de la renta; cupom fiscal, imposto de renda), but it has
  not been checked by a native speaker.
- The shops, addresses and tax numbers in the screenshots are invented. None is a real business.
- Still open before release: `ASC_APP_ID` in `apps/mobile/eas.json` and `CONTACT_EMAIL` in
  `docs/store/play-listing.md`.

## Rebuilding the screenshots

Needed after a UI change, or when `out/` is gone.

1. In `apps/mobile`, start Metro: `npx expo start --dev-client`.
2. In `store/screenshots/out/photos`, serve the receipt photos:
   `python3 -m http.server 8099 --bind 127.0.0.1`.
   If the photos are missing, rebuild them first with `tools/receipt-photo.swift`; its header has
   the usage.
3. Boot a simulator that has the dev build installed and no real receipts. The seed refuses to
   run on a real database.
4. Set the clock: `xcrun simctl status_bar <udid> override --time "9:41"`.
5. Capture one language: `tools/capture-ios.sh <udid> <lang> raw/iphone/<lang> <metro log file>`.
   This takes about 5 minutes per language.
6. Build every size: `tools/render.sh`.
7. Feature graphics: `tools/feature-graphic.swift`; its header has the usage. Pass
   `zero-receipt.json` as the slips file and the `00-free` caption from `captions.json` as the
   subtitle. `render.sh` already draws slide `00-free` with `tools/promo.swift`.
