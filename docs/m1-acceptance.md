# M1 Acceptance

Date: 2026-11-04. Branch `feat/m0-m1-foundation`. Host: macOS, iOS 27.0 simulator (iPhone 18 Pro Max, headless: no taps/rotation). No Android SDK, no iPad sim, no proxy tool.

## Checklist

| # | Item | Result | Evidence / reason |
|---|------|--------|-------------------|
| 1a | `npm test` | PASS | 22 suites, 144 tests passed |
| 1b | `npm run typecheck` | PASS | `tsc --noEmit` clean |
| 1c | `npx expo lint` | PASS | exit 0 |
| 2a | iOS iPhone sim fresh install (uninstall, `prebuild --clean`, `run:ios`): onboarding appears | PASS | `m1-evidence/01-onboarding-iphone.jpg` |
| 2b | Tabs render after onboarding done | PASS | `m1-evidence/03-tabs-iphone.jpg` (prefs pre-seeded by temporary local patch, reverted) |
| 2c | (dev) create receipt, read back, FTS search finds it on encrypted DB | PASS | `m1-evidence/02-db-check-iphone.jpg`; Metro log `DB_CHECK_RESULT created=... read_back_merchant=Indomaret search_hits=1` (auto-run via temporary patch, reverted) |
| 2d | Onboarding tapped through by hand; lock prompt on device | DEFERRED | Headless sim cannot tap. Owner, on physical device |
| 2e | Android emulator fresh install | DEFERRED | No Android SDK. Owner via EAS dev build |
| 2f | Pixel Fold folded/unfolded | DEFERRED | No Android SDK. Owner on Galaxy Z Fold / Pixel Fold |
| 2g | iPad simulator (Split View, rail) | DEFERRED | iPad sim wedged earlier; not retried. Owner |
| 3a | `meb.db` first 16 bytes not `SQLite format 3` | PASS | `b840 a39b 9120 563d f705 cdfa 6310 8f1c` |
| 3b | `sqlite3 meb.db "select count(*) from sqlite_master"` fails | PASS | `file is not a database (26)` |
| 3c | MMKV file (`Documents/mmkv/meb.prefs`) not plaintext | PASS | `strings` shows only noise; no `IDR`, `homeCurrency`, `done` |
| 4a | Static network audit | PASS | See below |
| 4b | Live proxy session, zero hosts | DEFERRED | No proxy tool. Owner (Proxyman/Charles) |
| 5 | (dev) screens and Settings dev section `__DEV__`-guarded | PASS | See below |

## Static network audit (item 4a)

Grep of `apps/mobile/src` and `apps/mobile/modules` for `fetch(`, `XMLHttpRequest`, `WebSocket`, `axios`, `http://`, `https://`, `URLSession`, `HttpURLConnection`, `OkHttp`: one hit, `modules/receipt-ai/ios/ReceiptAI.podspec` `s.homepage = 'https://docs.expo.dev/modules/'` (metadata, not runtime). No `expo-updates`, analytics, crash-reporting or telemetry deps in `package.json` or `app.config.ts`. `expo-web-browser` and `expo-linking` are installed but `expo-web-browser`/`Linking.openURL` are unused in `src`. Dev-only note: Metro/dev-client talks to the dev machine in debug builds; release builds do not.

## (dev) guards (item 5)

- `src/app/(dev)/db-check.tsx:12`, `db-spike.tsx:56`, `ai-spike.tsx:55`: `if (!__DEV__) return <Redirect href="/" />`. `db-spike`/`ai-spike` also skip effects when `!__DEV__`.
- `src/app/(tabs)/settings.tsx:125`: dev section wrapped in `{__DEV__ && ...}`.
- Routes intentionally kept for owner's physical-device AI test.

## Deferred device checks (owner)

1. Android EAS dev build: SQLCipher open, FTS search.
2. `receipt-ai` availability and parse on an AI-capable device.
3. Lock prompts, including passcode-only device.
4. Fold/unfold on Galaxy Z Fold and Pixel Fold.
5. iPad Split View.
6. Proxy network check (Proxyman/Charles): expect zero requests.
7. Task 2 OCR bake-off when the 20 receipt photos arrive.
8. Hand-driven onboarding and tabs on a physical device.

## Notes

Temporary local patches (seed prefs, redirect to `/db-check`, auto-run) were used for 2b/2c and fully reverted; `git diff` shows no source change. `ios/` and `android/` are gitignored.
