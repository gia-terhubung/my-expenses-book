# Master Project Plan: My Receipt Book (Offline-First Privacy Scanner)

## 1. Executive Summary & Product Vision

**My Receipt Book** is a private, lightning-fast document and receipt scanner that operates 100% locally on-device. Unlike cloud-dependent, subscription-heavy competitors (e.g., *Easy Expense*), it guarantees zero telemetry, zero mandatory account sign-ups, and complete data ownership. It features automated smart parsing (merchant name, totals, tax, dates), global multi-currency support, precise timestamp/timezone tracking, multilingual readiness, full-text offline search, and a subscription-free monetization model powered by a "Buy the Developer a Coffee" tip jar.

## 2. Competitive Advantage & Positioning

* **Zero Cloud Dependency by Default:** Unlike apps that force users onto remote servers and demand account creation, My Receipt Book stores all data locally in a secure SQLite database. Cloud backup is strictly an optional, user-initiated opt-in feature for the future.
* **Subscription-Free Simplicity:** No recurring monthly fees or locked scan limits. Free core utility with a friendly "Buy the Developer a Coffee" tip jar ($2.99, $4.99, $9.99 tiers).
* **Global & Travel-Ready:** Built from the ground up to handle multi-currency conversions and timezone preservation locally without needing constant internet connectivity.

## 3. Technical Stack & Architecture Rationale

The app is engineered for maximum performance, offline reliability, and seamless future scalability.

* **Framework & Runtime:** **React Native with Expo (Managed Workflow / Development Builds)**
  * *Why:* Expo streamlines cross-platform development while supporting native modules via Config Plugins. Using EAS Development Builds ensures access to high-performance native OS camera and OCR features.

* **Navigation:** **Expo Router**
  * *Why:* File-based routing provides an intuitive directory structure (`(tabs)`, `(modals)`, `(stack)`) that maps cleanly to mobile screen flows.

* **Local Database & Storage:** **`expo-sqlite` + Drizzle ORM**
  * *Why:* Provides a high-performance, lightweight local SQL database on the device. Drizzle ORM offers a type-safe, modern TypeScript syntax that maps almost 1:1 with **Supabase PostgreSQL**, ensuring frictionless synchronization when cloud backup is introduced later.

* **Key-Value State & Preferences:** **`react-native-mmkv`**
  * *Why:* Ultra-fast synchronous storage for app settings, user preferences, and local currency rate caches.

* **Scanner & OCR Core:**
  * `react-native-document-scanner-plugin` (Triggers native iOS VisionKit / Android ML Kit edge-detection and multi-page batching).
  * `react-native-nitro-ocr` (Executes high-speed text recognition entirely on-device using Apple Vision on iOS and bundled Google ML Kit on Android).

* **Monetization Infrastructure:** **RevenueCat SDK (`react-native-purchases`) + `expo-iap`**
  * *Why:* Simplifies managing in-app purchases and consumable tip jar products across both the Apple App Store and Google Play Store.

## 4. Global Scale, Localization, & Data Architecture

### A. Multilingual Option (Default English)
* **Implementation:** Integrate `i18next` with `react-i18next` for clean translation string management.
* **Requirements:** English must be the default fallback language. The app must support easy addition of secondary languages via JSON translation bundles stored locally.

### B. Multi-Currency Support (Global Distribution)
* **Currency Code Tracking:** Every receipt record must explicitly store an ISO 4217 currency code (e.g., `USD`, `EUR`, `IDR`, `SGD`).
* **Offline Exchange Rates:** The app downloads a lightweight currency conversion rate table once per week when an internet connection is available, storing it locally in MMKV. When viewing foreign receipts, the app converts them into the user's home currency in real-time. Manual currency code overrides must be supported in the UI.

### C. Timestamps & Timezone Handling
* **Storage Standard:** All creation timestamps must be stored as UTC Unix Epoch timestamps (milliseconds) or ISO 8601 strings to prevent sorting discrepancies.
* **Transaction Timezone Context:** Capture the local timezone offset (e.g., `UTC+7` or `Europe/Paris`) at the exact moment of scanning so historical receipts reflect the local time of purchase rather than shifting when the user travels.

## 5. App Store & Play Store Submission Preparation

Before submitting the app to production, complete the following prerequisites:
1. **Developer Accounts:** Active Apple Developer Program account (\$99/year) and Google Play Console developer account (\$25 one-time).
2. **Product Configuration:** Create **Consumable In-App Purchase products** in both stores for the tip jar tiers (`tip_coffee_small`, `tip_coffee_standard`, `tip_coffee_generous`).
3. **App Store Assets:** Privacy Policy URL explicitly stating that all scan data remains local on-device and is never uploaded to external servers unless cloud backup is explicitly enabled by the user.

## 6. Screen Directory Structure

```text
app/
├── (tabs)/
│   ├── index.tsx         # Home / Capture Feed (chronological list, totals, search entry, FAB camera button)
│   ├── search.tsx        # Global Full-Text Search (queries local SQLite raw OCR text instantly)
│   ├── folders.tsx       # Folders & Categories Hub (organizes scans by project/tax year with aggregated totals)
│   └── settings.tsx      # Privacy Vault, Storage Stats, Language Switcher, & Tip Jar UI
├── (modals)/
│   └── scanner.tsx       # Native multi-page batch scanning wrapper
└── (stack)/
    └── document/
        └── [id].tsx      # Document Detail & Edit View (image/PDF viewer, auto-parsed total/merchant/date fields, currency selector, export actions)
```