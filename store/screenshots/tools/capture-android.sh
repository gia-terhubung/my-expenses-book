#!/usr/bin/env bash
# Captures the 6 store screens for one language on an Android phone over adb (the Redmi for the
# Play phone set). Same screen names as capture-ios.sh: 01-review 02-home 03-zoom 04-stats 05-trip
# 06-search, written as <outdir>/<name>.png at the phone's own resolution.
# Needs: Metro on :8081 (npx expo start --dev-client) with its log in <metro-log>, the receipt photos
# served on :8099 (python3 -m http.server 8099 in store/screenshots/out/photos), the dev build installed.
# The first language on a phone wipes the app (owner approved for the Redmi, 2026-11-27) and goes
# through onboarding with the e2e helpers (E2E_ALLOW_WIPE=1 is set here; the helpers back up first).
# Usage: capture-android.sh <serial> <lang> <outdir> <metro-log>
#        capture-android.sh --self-test
# SHOTS="02-home 04-stats" re-shoots only those screens. FRESH=0 skips the wipe and onboarding.
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../.." && pwd)

# Stop when Metro logged an error since <line>: a dev error overlay would end up in the screenshot.
metro_clean_since() { # <log> <line>
  if tail -n +"$(($2 + 1))" "$1" | grep -q ' ERROR '; then
    echo "FAIL: Metro error during capture:" >&2
    tail -n +"$(($2 + 1))" "$1" | grep ' ERROR ' | head -3 >&2
    return 1
  fi
}

if [ "${1:-}" = --self-test ]; then
  t=$(mktemp); fails=0
  printf 'old ERROR before the start\nstart\n' > "$t"
  metro_clean_since "$t" 1 2>/dev/null && echo "PASS clean log since start" || { echo "FAIL clean log since start"; fails=1; }
  printf ' ERROR  The action was not handled\n' >> "$t"
  metro_clean_since "$t" 1 2>/dev/null && { echo "FAIL capture stops when the Metro log shows an ERROR"; fails=1; } || echo "PASS capture stops when the Metro log shows an ERROR"
  rm -f "$t"; exit $fails
fi

SERIAL=$1; LANG_=$2; OUT=$3; LOG=$4
BUNDLE=com.terhubung.myexpensesbook
DEV="exp+my-expenses-book://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
TODAY=${TODAY:-2026-11-24}
adb_() { adb -s "$SERIAL" "$@"; }
mkdir -p "$OUT"
read -r PW PH < <(sips -g pixelWidth -g pixelHeight "$HERE/../out/photos/$LANG_.jpg" | awk '/pixel/{print $2}' | xargs)
case "$LANG_" in en) QUERY=coffee ;; id) QUERY=kopi ;; es) QUERY=farmacia ;; pt-BR) QUERY=padaria ;; esac
label() { python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["tabs"][sys.argv[2]])' "$ROOT/apps/mobile/src/i18n/locales/$LANG_.json" "$1"; }

adb_ reverse tcp:8081 tcp:8081 >/dev/null
adb_ reverse tcp:8099 tcp:8099 >/dev/null

# Clean status bar: 09:41, full battery, no notifications. Back to normal on exit.
demo() { adb_ shell am broadcast -a com.android.systemui.demo -e command "$@" >/dev/null; }
adb_ shell settings put global sysui_demo_allowed 1
demo enter
demo clock -e hhmm 0941
demo battery -e level 100 -e plugged false
demo notifications -e visible false
demo network -e wifi show -e level 4
demo network -e mobile show -e level 4 -e datatype none
trap 'demo exit' EXIT

if [ "${FRESH:-1}" = 1 ]; then
  ( cd "$ROOT/apps/mobile" && E2E_PLATFORM=android E2E_ALLOW_WIPE=1 bash -c 'source e2e/lib.sh; e2e_init "$1" store-shots >/dev/null; e2e_fresh' _ "$SERIAL" ) ||
    { echo "FAIL: onboarding after the wipe" >&2; exit 1; }
fi

start=$(wc -l < "$LOG" | tr -d ' ')
fresh() { # cold launch, seed, open $1 (home|review|stats|trip)
  adb_ shell am force-stop "$BUNDLE"
  adb_ shell "am start -a android.intent.action.VIEW -d '$DEV' $BUNDLE" >/dev/null; sleep "${BOOT_WAIT:-14}"
  local before; before=$(grep -c "STORE_SHOTS_DONE" "$LOG")
  adb_ shell "am start -a android.intent.action.VIEW -d 'myexpensesbook://dev/store-shots?lang=$LANG_&today=$TODAY&w=$PW&h=$PH&then=$1&photo=http%3A%2F%2F127.0.0.1%3A8099%2F$LANG_.jpg' $BUNDLE" >/dev/null
  local ok=0
  for _ in $(seq 1 40); do [ "$(grep -c "STORE_SHOTS_DONE" "$LOG")" -gt "$before" ] && { ok=1; break; }; sleep 1; done
  [ "$ok" = 1 ] || { echo "FAIL: store data not seeded ($1)" >&2; exit 1; }
  sleep "${SCREEN_WAIT:-6}"
}
shot() { metro_clean_since "$LOG" "$start" || exit 1; adb_ exec-out screencap -p > "$OUT/$1.png" && echo "  $1"; }
tap() { adb_ shell input tap "$1" "$2"; }
# Tap the element whose text or content-desc is exactly $1 (uiautomator dump).
tap_label() {
  adb_ shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  local xy; xy=$(adb_ exec-out cat /sdcard/ui.xml | python3 -c '
import re,sys
x=sys.stdin.read(); t=re.escape(sys.argv[1])
m=re.search(r"(?:text|content-desc)=\"" + t + r"\"[^>]*bounds=\"\[(\d+),(\d+)\]\[(\d+),(\d+)\]\"", x)
print((int(m[1])+int(m[3]))//2, (int(m[2])+int(m[4]))//2) if m else None' "$1")
  [ -n "$xy" ] && [ "$xy" != None ] && tap $xy
}

want() { [ -z "${SHOTS:-}" ] || [[ " $SHOTS " == *" $1 "* ]]; }
echo "$LANG_ -> $OUT"
want 01-review && { fresh review; adb_ shell input swipe "${X_MID:-360}" "${Y_SWIPE_FROM:-1200}" "${X_MID:-360}" "${Y_SWIPE_TO:-900}" 400; sleep 3; shot 01-review; }
want 02-home && { fresh home; shot 02-home; }
want 03-zoom && { fresh review; tap "${X_PHOTO:-360}" "${Y_PHOTO:-520}"; sleep 4; shot 03-zoom; }
want 04-stats && { fresh stats; shot 04-stats; }
want 05-trip && { fresh trip; shot 05-trip; }
want 06-search && { fresh home; tap_label "$(label search)"; sleep 3
  tap "${X_FIELD:-360}" "${Y_FIELD:-200}"; sleep 2; adb_ shell input text "$QUERY"; sleep 3
  adb_ shell input keyevent 111; sleep 2; shot 06-search; }  # 111 = Escape: hides the keyboard
