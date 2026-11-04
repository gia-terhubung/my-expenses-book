# Spike: OCR bake-off (M0 Task 2)

Date: 2026-11-04 · Branch: `spike/ocr-bakeoff`

## Inputs

20 owner-supplied images in `apps/mobile/spikes/receipts/` (gitignored — contain real names,
account numbers, phone numbers). Raw OCR dumps in `apps/mobile/spikes/ocr-dumps/` (also
gitignored for the same reason). **Neither may ever be committed**; M2 parser fixtures must be
re-typed with synthetic names/numbers.

Composition (this matters more than the OCR numbers):

| Kind | Count | Examples |
|---|---|---|
| App screenshots (bank transfer / e-wallet / QRIS / marketplace order) | 15 | BCA, OCBC, Livin' Mandiri, BRI, Flip, GoPay, Shopee, PLN token |
| Printed paper receipts | 3 | Indomaret, BCA EDC + restaurant slip, BCA ATM slip |
| Handwritten notas | 2 | shop nota, party-rental faktur |

All 20 are IDR, Indonesian or English UI. No foreign-currency receipts.

## Wrappers evaluated (desk check, 2026-11-04)

| Package | Version | Last publish | Notes |
|---|---|---|---|
| `react-native-nitro-ocr` | 0.1.0-beta.0 | 2026-03 | beta, single maintainer, peer `react-native-nitro-modules ^0.35` while current is 0.37 |
| `@react-native-ml-kit/text-recognition` | 2.0.0 | 2025-09 | 14 months stale; ML Kit iOS pods historically lack arm64-simulator slices |

Neither was installed: both are thin wrappers over engines we can call directly from our own
Expo module (we already own `modules/receipt-ai`).

## Engine test: Apple Vision (`VNRecognizeTextRequest`, `.accurate`)

Run on macOS (Xcode 27.1 SDK) — same Vision framework as iOS. Script kept in session scratchpad,
not committed (throwaway).

| Config | Median ms | Notes |
|---|---|---|
| `automaticallyDetectsLanguage = true` | ~200 | Cyrillic/Thai/Arabic garbage on noisy paper (`3 рс`, `ปรพนจ…`); one image took 29 s |
| `recognitionLanguages = ["id-ID","en-US"]` | ~180 | No foreign-script garbage; slow image → 216 ms. First call after launch ~56 s on macOS (model cold load) — **warm up / measure on device** |

**Decision: always pin recognition languages** (`id-ID` + `en-US`, plus the user's UI language).

Accuracy — is the correct value present in the OCR text (parser not involved):

| Subset | Total present | Date present |
|---|---|---|
| Screenshots (15) | 15/15 | 15/15 |
| Printed paper (3) | 3/3 | 2/3 (EDC slip: `27 SEP. 20` — year misread `26`→`20`) |
| Handwritten (2) | 1/2 | 0/2 |
| **All (20)** | **19/20** | **17/20** |

Geometry: yes (bounding boxes per observation). Indonesian quality: good on print/screens.

## Engine test: Google ML Kit Text Recognition v2 (Android)

**Not run** — host has no Android SDK/emulator. Deferred to the owner's EAS device build
(same session as the receipt-ai physical-device test). Acceptance: same 20 images,
total ≥ 19/20, date ≥ 17/20.

## Scanner plugin

`react-native-document-scanner-plugin` 2.0.4 (2026-01): not exercised — simulator has no camera.
Deferred to device build.

## Decision

- **OCR = own Expo module, no third-party wrapper.** iOS: Apple Vision with pinned languages.
  Android: ML Kit Text Recognition v2 (Latin, bundled model) via Gradle directly.
  Exposed as `recognizeText(uri, languages) → { lines: { text, box }[], ms }`. Lives beside
  `receipt-ai` (M2 task). Removes dependence on two stale wrappers; we already maintain native code.
- Risk: Vision's `id-ID` support on iOS 16/17 unverified — fall back to `en-US` (Latin digits and
  keywords still read). Check `supportedRecognitionLanguages()` at runtime.

## Findings that change M2 scope (owner review)

1. **Screenshots are the main input (15/20), not camera scans.** "Import from Photos / Share to
   app" must be a first-class v1 capture path alongside the scanner. Screenshots OCR perfectly.
2. **Many items are transfers, top-ups, ATM withdrawals** — not purchases. Needs a product call:
   is a transfer an expense (category "Transfer") or excluded?
3. **Number formats mix in one locale:** `Rp96.000` (dot thousands) vs `IDR 100,000.00` (comma
   thousands, dot decimals) vs `RP 1, 000, 000. 00` (OCR spaces). Parser must decide per string.
4. **Multiple amounts per receipt:** base vs fee vs total (`Nominal Transfer`, `Biaya Admin`,
   `Total Transaksi`; `Rp 350.000` vs `Tagihan Rp 355.250`). Prefer total-keyword lines.
5. **Handwritten notas fail** — review screen must make manual entry fast; the LLM can't fix
   missing OCR text.
6. Fixture set has zero foreign-currency samples — the 50-fixture parser set must add synthetic
   foreign receipts (EN/ES/PT/JP/FR) to cover the travel persona.
