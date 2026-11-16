# Store privacy questionnaires: answers

These answers follow from the spec's anti-goals: no network call carries user data, and there is no analytics or crash SDK. Re-check them whenever a dependency or a network call is added.

Facts behind every answer:
- All receipt data (images, OCR text, amounts, notes) is stored only on the device, encrypted (SQLCipher DB, AES-256-GCM images).
- Outbound calls: (1) `cdn.jsdelivr.net` `@fawazahmed0/currency-api` exchange-rate tables. The request holds only a currency code and a date in the URL. (2) App Store / Google Play billing, only while the Tip jar screen is open.
- No account, no analytics, no ads, no crash reporting. The local error log never leaves the device unless the user exports it through the share sheet.
- Tips are consumable IAPs handled entirely by Apple/Google. The app stores no purchase record.

## Apple: App Store Connect → App Privacy

- **Data collection:** "No, we do not collect data from this app." The label shows **Data Not Collected**.
  - Why IAP doesn't count: Apple processes the purchase, and the developer receives no data linked to the user.
  - Why exchange-rate downloads don't count: they carry no user data.
- **Tracking:** No.
- **Export compliance:** the app uses only standard encryption provided by the OS and well-known algorithms (AES, scrypt). `ITSAppUsesNonExemptEncryption = NO`, set by `ios.config.usesNonExemptEncryption: false` in `app.config.ts`. No documentation upload is needed.

## Google Play: Play Console → App content → Data safety

- **Does your app collect or share any of the required user data types?** No.
- **Is all of the user data collected by your app encrypted in transit?** Yes. The only traffic is HTTPS: the FX tables and Play Billing.
- **Do you provide a way for users to request that their data is deleted?** Data is stored only on the device. Uninstalling the app, or clearing its storage, deletes it.
- **Independent security review:** No.

### Other App content forms

- **Ads:** No ads.
- **Target audience:** 18+ (finance tool, not directed at children).
- **Content rating questionnaire:** Utility / Productivity. No violence, sexual content, gambling or user-generated content shared with others.
- **Financial features declaration:** none of the listed regulated features (no banking, loans, payments, crypto). It is a personal expense record only.
- **Government app / News app / Health:** No.
