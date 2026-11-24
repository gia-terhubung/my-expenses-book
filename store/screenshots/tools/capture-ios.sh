#!/usr/bin/env bash
# Captures the 6 store screens for one language on one booted iOS simulator.
# Needs: Metro on :8081 (npx expo start --dev-client), the receipt photos served on :8099
# (python3 -m http.server 8099 in store/screenshots/out/photos), the dev build installed,
# and a database with no real receipts (the seed refuses otherwise).
# Usage: capture-ios.sh <udid> <lang> <outdir> <metro-log> [point-scale]
# Coordinates below are in points for a 440x956 pt portrait phone; other layouts pass their own.
set -u
UDID=$1; LANG_=$2; OUT=$3; LOG=$4
BUNDLE=com.terhubung.myexpensesbook
DEV="myexpensesbook://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
TODAY=${TODAY:-2026-11-24}
mkdir -p "$OUT"
read -r PW PH < <(sips -g pixelWidth -g pixelHeight "$(dirname "$0")/../out/photos/$LANG_.jpg" | awk '/pixel/{print $2}' | xargs)
case "$LANG_" in en) QUERY=coffee ;; id) QUERY=kopi ;; es) QUERY=farmacia ;; pt-BR) QUERY=padaria ;; esac

fresh() { # cold launch, seed, open $1 (home|review|stats|trip)
  timeout 30 xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1
  timeout 60 xcrun simctl openurl "$UDID" "$DEV" >/dev/null 2>&1; sleep "${BOOT_WAIT:-14}"
  local before; before=$(grep -c "STORE_SHOTS_DONE" "$LOG")
  timeout 60 xcrun simctl openurl "$UDID" "myexpensesbook://dev/store-shots?lang=$LANG_&today=$TODAY&w=$PW&h=$PH&then=$1&photo=http%3A%2F%2F127.0.0.1%3A8099%2F$LANG_.jpg" >/dev/null 2>&1
  for _ in $(seq 1 40); do [ "$(grep -c "STORE_SHOTS_DONE" "$LOG")" -gt "$before" ] && break; sleep 1; done
  sleep "${SCREEN_WAIT:-6}"
}
shot() { timeout 30 axe screenshot --udid "$UDID" --output "$OUT/$1.png" >/dev/null 2>&1 && echo "  $1"; }
tap() { timeout 30 axe tap -x "$1" -y "$2" --udid "$UDID" >/dev/null 2>&1; }

echo "$LANG_ -> $OUT"
fresh review; timeout 30 axe swipe --start-x "${X_MID:-220}" --start-y "${Y_SWIPE_FROM:-700}" --end-x "${X_MID:-220}" --end-y "${Y_SWIPE_TO:-520}" --udid "$UDID" >/dev/null 2>&1; sleep 3; shot 01-review
fresh home; shot 02-home
# The full-screen viewer at fit: the whole receipt, sharp. (A 2.5x zoom cut every line in half.)
fresh review; tap "${X_MID:-220}" "${Y_PHOTO:-300}"; sleep 4; shot 03-zoom
fresh stats; shot 04-stats
fresh trip; shot 05-trip
fresh home; tap "${X_SEARCH_TAB:-145}" "${Y_TABS:-877}"; sleep 3; tap "${X_FIELD:-180}" "${Y_FIELD:-117}"; sleep 2
timeout 30 axe type "$QUERY" --udid "$UDID" >/dev/null 2>&1; sleep 3
tap "${X_MID:-220}" "${Y_BLANK:-60}"; sleep 2; shot 06-search
