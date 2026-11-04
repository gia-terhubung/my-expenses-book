# Spike: `modules/receipt-ai` on-device LLM availability + parse (Task 3)

Date: 2026-11-04. Expo SDK 58, local Expo module created with
`npx create-expo-module@latest receipt-ai --local --barrel --name ReceiptAI --package expo.modules.receiptai -p apple android --features AsyncFunction`.

- Module: `apps/mobile/modules/receipt-ai/` (Swift `ios/ReceiptAIModule.swift`, Kotlin `android/src/main/java/expo/modules/receiptai/ReceiptAIModule.kt`).
- Spike screen: `apps/mobile/src/app/(dev)/ai-spike.tsx` (`__DEV__` only). On mount it runs availability plus all 5 bundled OCR samples, renders the results, and logs a `AI_SPIKE_RESULT_BEGIN … AI_SPIKE_RESULT_END` block. It also has a paste box and a Parse button.
- OCR samples: `apps/mobile/spikes/ocr-samples/*.txt` (hand-written stand-ins for Task 2, which is deferred until the owner supplies photos). `index.ts` in that folder is generated from the `.txt` files.

## JS interface (kept for M2)

```ts
ReceiptAI.getAvailability(): Promise<{ available: boolean; engine: 'apple_fm' | 'gemini_nano' | null; reason?: string }>
ReceiptAI.parseReceipt(ocrText: string, hints: { locale: string; homeCurrency: string }): Promise<string> // JSON string, validate in JS
```

`reason` values:

| Platform | Value | Meaning |
|---|---|---|
| iOS < 26 | `os` | OS too old (`engine: null`) |
| iOS 26+ | `deviceNotEligible` | Device can't run Apple Intelligence |
| iOS 26+ | `appleIntelligenceNotEnabled` | Apple Intelligence is turned off |
| iOS 26+ | `modelNotReady` | Model not ready (`engine: 'apple_fm'`) |
| Android | `downloadable` | Model can be downloaded (`engine: 'gemini_nano'`) |
| Android | `downloading` | Model download in progress (`engine: 'gemini_nano'`) |
| Android | `device` | Unsupported device, or `checkStatus()` threw (`engine: null`) |
| Web | `platform` | Not supported on web |

`parseReceipt` rejects with an error when the model is unavailable or generation fails. The caller must fall back to the heuristic parser.

Output JSON shape (all strings): `{"merchant","purchasedAt","total","tax","currency"}`. On iOS the shape comes from `@Generable struct Receipt` via `response.rawContent.jsonString`. On Android it comes from prompt-only instructions, so the result is free text that should be JSON. The JS side must extract and validate it.

## Results

### iOS: compiles, availability works, generation blocked in the simulator

Setup: Xcode 27.1, iOS 27.0 simulator (iPhone 18 Pro Max), host Apple M2 Mac on macOS 27.0.1, dev build via `npx expo run:ios`.

```
AI_SPIKE_RESULT_BEGIN
availability={"engine":"apple_fm","available":true}
01-indomaret-id: 8718ms ERROR The operation couldn’t be completed. (com.apple.SensitiveContentAnalysisML error 15.)
02-starbucks-us: 344ms ERROR The operation couldn’t be completed. (com.apple.SensitiveContentAnalysisML error 15.)
03-paris-cafe-fr: 55ms ERROR The operation couldn’t be completed. (com.apple.SensitiveContentAnalysisML error 15.)
04-grab-ride-id: 60ms ERROR The operation couldn’t be completed. (com.apple.SensitiveContentAnalysisML error 15.)
05-tokyo-konbini-ja: 78ms ERROR The operation couldn’t be completed. (com.apple.SensitiveContentAnalysisML error 15.)
AI_SPIKE_RESULT_END
```

Screenshot: `docs/spikes/2026-11-receipt-ai-ios.png`.

- **Swift compiles** with deployment target 16.4. The code is guarded by `#if canImport(FoundationModels)` and `if #available(iOS 26, *)`, and `FoundationModels` is weak-linked. The build had 0 errors, and the app launched without crashing.
- **`availability` reported `.available`** in the simulator.
- **Generation failed** for every sample, and the error path did not crash. The simulator log shows the root cause. The input safety guardrail model (`com.apple.fm.language.instruct_300m.mm_guard`) is refused by `modelmanagerd`:

  ```
  ModelManagerError InferenceError::operationNotAllowed::Simulator is not supported
  End sanitizeText with error: Error Domain=com.apple.SensitiveContentAnalysisML Code=15 "SCML.CombinedTextSanitizerBackend.BackendError("SafetyGuardrailTextSanitizerBackend"): InferenceError::operationNotAllowed::Simulator is not supported"
  ```

- I also tried `SystemLanguageModel(guardrails: .permissiveContentTransformations)`. It failed with the same error, because the input sanitizer still runs. That experiment was reverted and is not in the committed code.
- I tried a host check: a macOS command-line harness ran the same `Receipt`/`AppleFMParser` code against the Mac's own model. It reported `unavailable(modelNotReady)` and returned "The model is not available. Try again later." So the host Mac's model is not ready, even though the simulator's availability check returned `.available`.
- **Latency and accuracy:** not measurable. No sample produced model output. The 8.7 s on the first call is guardrail model load plus failure, not inference.

### Android: unverified

This host has no Android SDK and no Java, so the Kotlin code has never been compiled. It will be verified via an EAS build on the owner's device.

- `npx expo prebuild -p android` succeeded.
- `expo-modules-autolinking resolve -p android` lists `receipt-ai` with `expo.modules.receiptai.ReceiptAIModule`.
- Dependency: `implementation "com.google.mlkit:genai-prompt:1.0.0-beta4"` in the module's `android/build.gradle`. This is the version on the ML Kit get-started page. Google Maven also has `1.0.0-beta5`, published 2026-10-26.
- API used: `Generation.getClient()`, suspend `checkStatus()` returning `FeatureStatus.{AVAILABLE,DOWNLOADABLE,DOWNLOADING,UNAVAILABLE}` from `com.google.mlkit.genai.common`, and suspend `generateContent(String)` with `response.candidates[0].text`. These signatures were checked against the beta4 AAR's class files (`GenerativeModel`, `Generation`, `GenerateContentResponse`, `Candidate`, `FeatureStatus`), not only the docs.
- The AAR declares `minSdkVersion 26`, which matches our minimum. It also merges in the permission `com.google.android.apps.aicore.service.BIND_SERVICE`.
- Emulator and unsupported devices should report `available:false`. The `checkStatus()` call is wrapped in a try/catch that returns `reason: "device"`. This is untested.
- The spike does not trigger a model download. In the `DOWNLOADABLE` state, `parseReceipt` throws `ERR_UNAVAILABLE`. M2 must decide whether to call `download()` and when.

## Expected fields for the OCR samples (accuracy reference)

| Sample | merchant | purchasedAt | total | tax | currency |
|---|---|---|---|---|---|
| 01-indomaret-id | INDOMARET | 2026-11-04T13:42 | 58000 | 5748 (PPN, included) | IDR |
| 02-starbucks-us | STARBUCKS | 2026-11-02T08:17 | 21.19 | 1.99 | USD |
| 03-paris-cafe-fr | CAFE DE L'ODEON | 2026-11-02T16:24 | 34.30 | 3.12 (TVA, included) | EUR |
| 04-grab-ride-id | Grab | 2026-11-03T19:05 | 34500 | "" (tax included, not shown) | IDR |
| 05-tokyo-konbini-ja | ファミリーマート (FamilyMart) | 2026-11-01T22:31 | 839 | 62 (内消費税, included) | JPY |

Traps built into the samples:

- **01:** Thousands separator is `.`; the date is `DD.MM.YY`; the cash tendered (100.000) and change are not the total.
- **02:** The `$  21.19` has a broken space; the date is US `MM/DD`.
- **03:** Decimal separator is `,`; HT is not the total.
- **04:** A negative promo line; `Rp` amounts.
- **05:** Full-width text and a `¥` sign.

Accuracy against this table: **not yet measured, 0/5 runs produced output.**

## Model-download behaviour

- **iOS:** The OS manages the model through Apple Intelligence settings; the app cannot trigger a download. `modelNotReady` is the "still downloading" state, and the host Mac currently reports it.
- **Android:** AICore manages the model. `checkStatus()` can return `DOWNLOADABLE` or `DOWNLOADING`, and `download()` returns a `Flow<DownloadStatus>`. The spike does not call `download()`.

## Gotchas

1. **A `.available` result does not mean `respond()` will succeed.** In the iOS 27 simulator, availability is `.available`, but every request fails with `SensitiveContentAnalysisML error 15` ("Simulator is not supported" in the guardrail). M2 must treat a `parseReceipt` rejection as normal and fall back to heuristics. End-to-end checks need a physical Apple Intelligence iPhone (iPhone 15 Pro or later).
2. Deployment target 16.4 needs `#if canImport(FoundationModels)`, `@available(iOS 26, *)`, and `s.weak_frameworks = 'FoundationModels'` in the podspec. Without the weak link, the app can fail to launch on iOS 16–25.
3. The Apple Foundation Models web docs render in JavaScript, so `WebFetch` gets nothing from them. The API was checked against the SDK's `FoundationModels.swiftinterface` in Xcode 27.1 instead. `UnavailableReason` has 3 cases. iOS 27 adds `PrivateCloudComputeLanguageModel`, which is not used here.
4. The `respond(to:generating:)` overloads in iOS 27 add `contextOptions`/`metadata`. The iOS 26 form `respond(to: String, generating:)` still resolves.
5. The ML Kit docs show `1.0.0-beta4`, while Maven's latest is `1.0.0-beta5`. The API is still beta, so pin an exact version.
6. The Android Prompt API has no schema-constrained output in the `generateContent` path used here. The AAR has `GenerateTypedContentRequest` plus a `genai-schema` dependency, which may give typed output. Evaluate it in M2.
7. `create-expo-module` printed "Couldn't download the versioned template from npm, falling back to the latest version". The template was 58.0.9, so it matches the SDK. It also generated `LICENSE`/`CHANGELOG.md` despite the defaults; I deleted them. I also removed `tvos` from the podspec.
8. The app imports the module by relative path (`../../../modules/receipt-ai`), because the `@/*` alias maps to `src/*`.
9. Typed routes: `tsc` fails on a new `href` until `expo start` regenerates `.expo/types`.

## Decision

**Defer the AI path to v1.1** (slip policy item 3), unless a physical-device check before M2 says otherwise:

- No platform produced a single parse here. iOS generation is blocked in the simulator, the host Mac's model is `modelNotReady`, and Android has not been compiled or run.
- Accuracy and latency, the inputs to the go decision, are still unknown.

What is kept: the module, its JS interface, and the availability and fallback plumbing. The interface is stable and the code compiles on iOS, so M2 can ship heuristics-only with `getAvailability()` wired in.

**To flip to go:**

- Run the spike screen on an iPhone 15 Pro or later with Apple Intelligence on, and on a Gemini Nano device via EAS.
- Accuracy target: at least 4/5 samples with total and currency correct.
- Latency target: p50 under 3 s.
