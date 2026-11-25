# App: submission prep (notification icon, permissions, checklist)

Date: 2026-11-25. Status: approved by the owner. Short design.

## Intent

Before the first App Store and Google Play submission, close the app-side gaps the audit found and keep
one list of everything still open.

## Goals

- Android status-bar notification icon: a white glyph on transparent, from the existing monochrome logo
  (`assets/images/android-icon-monochrome.png`), tinted with the brand green `#1F5C4C`. Set via the
  `expo-notifications` plugin (`icon`, `color`).
- Block the unused Android permissions `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` and
  `SYSTEM_ALERT_WINDOW` (`android.blockedPermissions`).
- `docs/store/submission-checklist.md`: every open item, each marked code / owner / store.

## Non-goals

- iOS notification icon (iOS always uses the app icon).
- Filling owner-only values (`ASC_APP_ID`, `CONTACT_EMAIL`, Play service-account key).
- A native build or a submission.

## Anti-goals

- A notification glyph that differs from the brand mark, or one with colour or opaque pixels (Android
  renders those as a solid blob).
- Blocking a permission a feature needs: camera (document scanner), photos (picker), biometrics,
  notifications, internet (exchange rates, store prices) and vibrate stay.

## Approaches

- **Derive the glyph from the monochrome logo (picked).** Same mark as the themed launcher icon.
- Draw a new glyph. More work, no gain.
- Leave the permissions. They show on the Play listing and contradict "nothing leaves the phone".

## Left to the builder

- Glyph size: 96x96 source, logo cropped to its safe zone so it fills the 24 dp icon.
- Verify with `expo prebuild` output (manifest, `notification_icon` drawables, colour) and the tests.
