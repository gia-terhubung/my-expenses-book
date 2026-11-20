# Store privacy questionnaires: answers

These answers reflect the app as built. The app makes no network call that carries receipt data. On Android, Google ML Kit sends Google its own diagnostics (see below). Re-check them whenever a dependency or a network call is added.

Facts behind every answer:
- All receipt data (images, OCR text, amounts, notes) is stored only on the device, encrypted (SQLCipher DB, AES-256-GCM images).
- Outbound calls made by the app: (1) `cdn.jsdelivr.net` `@fawazahmed0/currency-api` exchange-rate tables. The request holds only a currency code and a date in the URL. (2) App Store / Google Play billing requests (products, purchase, recovery), only from the Tip jar screen. On iOS, expo-iap's StoreKit observer starts at app launch, but it makes no request of its own until Tip jar opens.
- **Android only:** Google ML Kit (`text-recognition`, `genai-prompt`, `play-services-mlkit-document-scanner`) sends Google diagnostics and usage data: device info, app package and version, per-installation identifiers, and performance metrics. It may also download models. Per Google's ML Kit data disclosure (developers.google.com/ml-kit/android-data-disclosure), this data is not shared with third parties and is encrypted in transit. iOS uses Apple Vision: nothing is sent.
- Recurring-expense reminders are local notifications. The device schedules and delivers them. They send nothing: no push token, no server, no new host. Android's expo-notifications FCM service is expected to stay inert (to be confirmed by R6, the D5-style proxy run in `docs/v1-recurring-acceptance.md`).
- No account, no analytics, no ads, no crash reporting. The local error log never leaves the device unless the user exports it through the share sheet.
- Tips are consumable IAPs handled entirely by Apple/Google. The app stores no purchase record.

## Apple: App Store Connect → App Privacy

- **Data collection:** "No, we do not collect data from this app." The label shows **Data Not Collected**.
  - Why IAP doesn't count: Apple processes the purchase, and the developer receives no data linked to the user.
  - Why exchange-rate downloads don't count: they carry no user data.
- **Tracking:** No.
- **Export compliance:** the app uses only standard encryption provided by the OS and well-known algorithms (AES, scrypt). `ITSAppUsesNonExemptEncryption = NO`, set by `ios.config.usesNonExemptEncryption: false` in `app.config.ts`. No documentation upload is needed.

## Google Play: Play Console → App content → Data safety

The Android build collects data through Google ML Kit (see the facts above), so the answer is **not** "no data collected".

- **Does your app collect or share any of the required user data types?** Yes, collected (not shared):
  - **App info and performance → Diagnostics:** collected; purpose **Analytics** (ML Kit diagnostics); processed ephemerally: no; required.
  - **Device or other IDs:** collected; purpose **Analytics** (ML Kit per-installation identifier); required.
  - Nothing else. Receipt images, text, amounts and financial info never leave the device.
- **Is any of it shared with third parties?** No (Google, as the SDK provider, processes it for the developer).
- **Is all of the user data collected by your app encrypted in transit?** Yes (HTTPS).
- **Do you provide a way for users to request that their data is deleted?** Receipt data is stored only on the device; uninstalling deletes it. ML Kit diagnostics are not linked to the user. If the form requires a deletion path, state that there is no account and no user-linked data.
- **Independent security review:** No.

> **Owner decision needed:** the spec's anti-goals forbid any SDK that phones home by default, and ML Kit does, on Android only. Either accept it and disclose it (the answers above), or replace the Android OCR, scanner and AI paths. Re-confirm with the D5 proxy run before submitting.

### Other App content forms

- **Ads:** No ads.
- **Target audience:** 18+ (finance tool, not directed at children).
- **Content rating questionnaire:** Utility / Productivity. No violence, sexual content, gambling or user-generated content shared with others.
- **Financial features declaration:** none of the listed regulated features (no banking, loans, payments, crypto). It is a personal expense record only.
- **Government app / News app / Health:** No.
