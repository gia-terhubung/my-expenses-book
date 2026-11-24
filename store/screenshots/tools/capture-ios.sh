#!/usr/bin/env bash
# Captures the 6 store screens for one language on one booted iOS simulator.
# Needs: Metro on :8081 (npx expo start --dev-client), the receipt photos served on :8099
# (python3 -m http.server 8099 in store/screenshots/out/photos), the dev build installed,
# and a database with no real receipts (the seed refuses otherwise).
# Usage: capture-ios.sh <udid> <lang> <outdir> <metro-log>
# SHOTS="02-home 04-stats" re-shoots only those screens (default: all six).
# Coordinates below are in points for a 440x956 pt portrait phone; other layouts pass their own.
set -u
UDID=$1; LANG_=$2; OUT=$3; LOG=$4
BUNDLE=com.terhubung.myexpensesbook
DEV="myexpensesbook://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
TODAY=${TODAY:-2026-11-24}
mkdir -p "$OUT"
# Development build chrome off: no dev-menu onboarding sheet, no menu at launch, no floating button.
for k in EXDevMenuIsOnboardingFinished EXDevMenuDisableAutoLaunch; do
  timeout 20 xcrun simctl spawn "$UDID" defaults write "$BUNDLE" "$k" -bool YES
done
for k in EXDevMenuShowsAtLaunch EXDevMenuShowFloatingActionButton; do
  timeout 20 xcrun simctl spawn "$UDID" defaults write "$BUNDLE" "$k" -bool NO
done
read -r PW PH < <(sips -g pixelWidth -g pixelHeight "$(dirname "$0")/../out/photos/$LANG_.jpg" | awk '/pixel/{print $2}' | xargs)
case "$LANG_" in en) QUERY=coffee ;; id) QUERY=kopi ;; es) QUERY=farmacia ;; pt-BR) QUERY=padaria ;; esac
# The simulator's region per store, so native controls (the date chip) use that country's order.
case "$LANG_" in en) LOC=en_US; L1=en-US ;; id) LOC=id_ID; L1=id ;; es) LOC=es_ES; L1=es-ES ;; pt-BR) LOC=pt_BR; L1=pt-BR ;; esac
timeout 20 xcrun simctl spawn "$UDID" defaults write -g AppleLocale "$LOC"
timeout 20 xcrun simctl spawn "$UDID" defaults write -g AppleLanguages -array "$L1" en

# Some simulators ask "Open in My Expenses Book?" on every deep link: accept it when shown.
# OPEN_X/OPEN_Y tap the alert's Open button by position (system alerts are not in the app's tree).
accept() {
  sleep 3
  if [ -n "${OPEN_X:-}" ]; then timeout 15 axe tap -x "$OPEN_X" -y "$OPEN_Y" --udid "$UDID" >/dev/null 2>&1
  else timeout 15 axe tap --label "Open" --udid "$UDID" >/dev/null 2>&1; fi
}
fresh() { # cold launch, seed, open $1 (home|review|stats|trip)
  timeout 30 xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1
  timeout 60 xcrun simctl openurl "$UDID" "$DEV" >/dev/null 2>&1; accept; sleep "${BOOT_WAIT:-14}"
  local before; before=$(grep -c "STORE_SHOTS_DONE" "$LOG")
  timeout 60 xcrun simctl openurl "$UDID" "myexpensesbook://dev/store-shots?lang=$LANG_&today=$TODAY&w=$PW&h=$PH&then=$1&photo=http%3A%2F%2F127.0.0.1%3A8099%2F$LANG_.jpg" >/dev/null 2>&1; accept
  for _ in $(seq 1 40); do [ "$(grep -c "STORE_SHOTS_DONE" "$LOG")" -gt "$before" ] && break; sleep 1; done
  sleep "${SCREEN_WAIT:-6}"
}
shot() { timeout 30 axe screenshot --udid "$UDID" --output "$OUT/$1.png" >/dev/null 2>&1 && echo "  $1"; }
tap() { timeout 30 axe tap -x "$1" -y "$2" --udid "$UDID" >/dev/null 2>&1; }

want() { [ -z "${SHOTS:-}" ] || [[ " $SHOTS " == *" $1 "* ]]; }
echo "$LANG_ -> $OUT"
want 01-review && { fresh review; timeout 30 axe swipe --start-x "${X_MID:-220}" --start-y "${Y_SWIPE_FROM:-700}" --end-x "${X_MID:-220}" --end-y "${Y_SWIPE_TO:-520}" --udid "$UDID" >/dev/null 2>&1; sleep 3; shot 01-review; }
# HOME_ROW_X/Y (split layouts): select a receipt so the detail pane is not empty.
want 02-home && { fresh home; [ -n "${HOME_ROW_X:-}" ] && { tap "$HOME_ROW_X" "$HOME_ROW_Y"; sleep 3; }; shot 02-home; }
# The full-screen viewer at fit: the whole receipt, sharp. (A 2.5x zoom cut every line in half.)
want 03-zoom && { fresh review; tap "${X_PHOTO:-${X_MID:-220}}" "${Y_PHOTO:-300}"; sleep 4; shot 03-zoom; }
want 04-stats && { fresh stats; shot 04-stats; }
want 05-trip && { fresh trip; [ -n "${TRIP_ROW_X:-}" ] && { tap "$TRIP_ROW_X" "$TRIP_ROW_Y"; sleep 3; }; shot 05-trip; }
want 06-search && { fresh home; tap "${X_SEARCH_TAB:-145}" "${Y_TABS:-877}"; sleep 3; tap "${X_FIELD:-180}" "${Y_FIELD:-117}"; sleep 2
timeout 30 axe type "$QUERY" --udid "$UDID" >/dev/null 2>&1; sleep 3
tap "${X_MID:-220}" "${Y_BLANK:-60}"; sleep 2
[ -n "${SEARCH_ROW_X:-}" ] && { tap "$SEARCH_ROW_X" "$SEARCH_ROW_Y"; sleep 3; }; shot 06-search; }
