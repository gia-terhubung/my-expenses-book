# Submission checklist: version 1.0

State on 2026-11-25. One list of everything between the code on `main` and the first App Store and Google
Play submission. **Who** is one of: **code** (a change in this repo), **owner** (only you can do it, usually
an account, a value or a device), **store** (a form or setting in App Store Connect or Play Console).

## Done

- [x] Website live at https://meb.terhubung.app with `/privacy` and `/terms`; the app's `PRIVACY_POLICY_URL`
      (`apps/mobile/src/about/links.ts`) and `apps/mobile/store.config.json` point to it.
- [x] Store screenshots and feature graphics, 4 languages, 8 slides with the privacy story
      (`store/screenshots/out/`, git-ignored; `tools/check.sh` verifies them).
- [x] Store text, 4 languages: `apps/mobile/store.config.json` (App Store), `docs/store/play-listing.md` (Play).
- [x] Privacy answers for both stores: `docs/store/privacy-answers.md`.
- [x] iOS: encryption export flag (`usesNonExemptEncryption: false`), privacy manifest (no tracking, no data
      collected), camera / photos / Face ID permission text, no push entitlement (local notifications only).
- [x] Android notification icon: white glyph from the monochrome logo, tinted `#1F5C4C`
      (`assets/images/notification-icon.png`, `expo-notifications` plugin options). iOS uses the app icon.
- [x] Android permissions trimmed: `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`,
      `SYSTEM_ALERT_WINDOW` and `RECORD_AUDIO` blocked; `CAMERA` was already blocked (the scanner is Google's).
      Remaining: `INTERNET`, `USE_BIOMETRIC`, `USE_FINGERPRINT`, `VIBRATE`, `POST_NOTIFICATIONS`.
- [x] Android backup off (`allowBackup: false`); versions managed by EAS (`appVersionSource: remote`,
      `autoIncrement`).

## Before the release build

| Who | Item | Where |
|---|---|---|
| owner | Send the App Store Connect app's Apple ID; it replaces `ASC_APP_ID` | `apps/mobile/eas.json` |
| owner | Choose the support contact email; it replaces `CONTACT_EMAIL` | `docs/store/play-listing.md` |
| owner | Create the Play service-account key for `eas submit` and save it as `apps/mobile/secrets/play-service-account.json` (git-ignored; never commit it) | Google Cloud + Play Console → Users and permissions |
| owner | Native-speaker review of the Spanish and Portuguese store text and app strings | `docs/store/play-listing.md`, `store.config.json`, `src/i18n` |
| code | New production builds for iOS and Android: they carry the notification icon, the permission block list and the `CFBundleLocalizations` fix | `eas build --profile production` |
| owner | On the new Android build, on an Android 12 or older device or emulator: import a photo from the gallery (checks the storage permission removal) | device |
| owner | On the new Android build: trigger a recurring reminder and look at the status bar (green glyph, not a white square) | device |
| owner | Recurring reminders acceptance: R1 on a real iPhone, R2 to R6 | `docs/v1-recurring-acceptance.md` |
| owner | Pinch-zoom the receipt photo by hand on a real iPhone and the Redmi | photo viewer |

## Money: tip jar

| Who | Item | Where |
|---|---|---|
| owner | Add the PT's business bank account in App Store Connect; then the Paid Apps agreement goes Active | App Store Connect → Business |
| owner | Enrol in the App Store Small Business Program (15%) | developer.apple.com |
| store | Create the three consumables `tip_coffee_small`, `tip_coffee_standard`, `tip_coffee_generous` with review screenshot and notes, and attach them to version 1.0 (the first in-app purchases must be submitted with an app version) | App Store Connect → In-App Purchases |
| owner | Play: add the payout bank, fill the phone number, check NPWP tax info, enrol in the 15% service-fee tier | payments.google.com, Play Console |
| store | Play: create the same three in-app products | Play Console → Monetize → Products |
| code | Web: tip-jar screenshot, if wanted, once sandbox prices load (optional; the section is text-only now) | `apps/web` |

## Store forms

| Who | Item | Where |
|---|---|---|
| store | App Privacy (Apple) and Data safety (Play), from the prepared answers | `docs/store/privacy-answers.md` |
| store | Age rating (Apple) and content rating questionnaire (Play) | App Store Connect, Play Console → App content |
| store | Play: target audience (18+ recommended for a finance app), ads = none, app access = no login needed, government app = no | Play Console → App content |
| store | Play: financial features declaration: the app keeps personal expense records only; no loans, payments, banking or crypto | Play Console → App content |
| store | Play: category Finance, contact details, privacy policy URL `https://meb.terhubung.app/privacy` | Play Console → Store settings |
| store | Apple: privacy policy URL and support URL per language (in `store.config.json`), category Finance, copyright "2026 PT Terhubung Lebih Lagi" | App Store Connect |
| store | Apple review notes: no account or login; tips unlock nothing; camera is used only by the document scanner | App Store Connect → App Review Information |
| store | Upload screenshots per device and language | `docs/store/submit-screenshots-and-languages.md` |

## Launch

| Who | Item | Where |
|---|---|---|
| store | Play: release to the internal track first (`eas.json` submit `track: internal`), then production | Play Console |
| code | Website: fill `STORE_LINKS` with the live listing URLs, so the official badges replace "Coming soon" | `apps/web/src/config/site.ts` |
