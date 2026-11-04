# Spike: SQLCipher + FTS5 on device (Task 4)

Date: 2026-11-04. expo-sqlite ~58.0.15, config plugin `["expo-sqlite", { useSQLCipher: true }]`.
Spike screen: `apps/mobile/src/app/(dev)/db-spike.tsx` (runs automatically on mount, `__DEV__` only).

## Results (iOS 27.0 simulator, iPhone 18 Pro Max, dev build)

```
cipher_version="4.17.0 community"
fts5_match=[{"body":"coffee at the corner cafe"}]
wrong_key_error=Error code 26: file is not a database
reopen_right_key_rows=2
```

Screenshot: `docs/spikes/2026-11-sqlcipher-ios.png`.

Key format used: `PRAGMA key = "x'<64 hex>'"` (raw key, no KDF).

## Exact wrong-key error (JS `error.message`)

Surfaced on the first read after `PRAGMA key` with the wrong key (the `PRAGMA key` itself does not throw).

```
Error code 26: file is not a database
```

Note: it has the prefix `Error code 26: `. Task 8 must match with `includes("file is not a database")` (or code 26), not strict equality.

## Plaintext check (pulled from simulator container, `Documents/SQLite/spike.db`)

- First 16 bytes are random (no `SQLite format 3` header): `d584ee3c c2ee5d55 2ed80c58 3f9ccd99`.
- `sqlite3 spike.db .tables` printed nothing with exit 0 (newer CLI does not read the file for this dot-command; it is not proof by itself).
- `sqlite3 spike.db "select count(*) from sqlite_master"` fails:

```
Parse error in 2nd command line argument: file is not a database (26)
```

=> file encrypted.

## Android

No Android SDK on host; device run deferred (no Android SDK; EAS later).
`npx expo prebuild -p android` applied the setting: `android/gradle.properties:80: expo.sqlite.useSQLCipher=true`;
expo-sqlite's `android/build.gradle` reads `findProperty('expo.sqlite.useSQLCipher') == 'true'` and builds from `vendor/sqlcipher`.
iOS: `ios/Podfile.properties.json` has `"expo.sqlite.useSQLCipher": "true"`.

## Gotchas

- Changing `useSQLCipher` needs `npx expo prebuild` + native rebuild. Without it, `PRAGMA key` silently no-ops (unencrypted DB). Always assert `PRAGMA cipher_version` is non-empty before keying.
- `simctl openurl` of a custom scheme shows an "Open in app?" prompt that cannot be tapped headlessly; spike was driven by temporarily redirecting index to the route (reverted).

## Decision

SQLCipher (4.17.0 community) and FTS5 both work together on iOS; wrong key yields a reliable detectable error. Proceed with expo-sqlite + SQLCipher. Android confirmed at config level only.
