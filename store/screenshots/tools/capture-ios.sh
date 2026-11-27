#!/usr/bin/env bash
# Captures the 6 store screens for one language on one booted iOS simulator.
# Needs: Metro on :8081 (npx expo start --dev-client), the receipt photos served on :8099
# (python3 -m http.server 8099 in store/screenshots/out/photos), the dev build installed,
# and a database with no real receipts (the seed refuses otherwise).
# Usage: capture-ios.sh <udid> <lang> <outdir> <metro-log>
# SHOTS="02-home 04-stats" re-shoots only those screens (default: all six).
# Coordinates below are in points for a 440x956 pt portrait phone; other layouts pass their own.
# ROTATE=landscape turns the device sideways before capturing (the open Duo, held wide).
#        capture-ios.sh --self-test
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../.." && pwd)

# Any app string in a language, by its key (e.g. review.openPhoto).
i18n() { python3 -c 'import json,sys
d=json.load(open(sys.argv[1]))
for k in sys.argv[2].split("."): d=d[k]
print(d)' "$ROOT/apps/mobile/src/i18n/locales/$1.json" "$2"; }
# A tab's label in a language (the native tab bar is tapped by label, not by position).
label() { python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["tabs"][sys.argv[2]])' "$ROOT/apps/mobile/src/i18n/locales/$1.json" "$2"; }
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
  [ "$(label es search)" = Buscar ] && echo "PASS tab label lookup" || { echo "FAIL tab label lookup"; fails=1; }
  [ "$(printf ' 12 ' | tr -d ' ')" = 12 ] && echo "PASS system tr not shadowed" || { echo "FAIL system tr not shadowed"; fails=1; }
  printf 'old ERROR before the start\nstart\n' > "$t"
  metro_clean_since "$t" 1 2>/dev/null && echo "PASS clean log since start" || { echo "FAIL clean log since start"; fails=1; }
  printf ' ERROR  The action was not handled\n' >> "$t"
  metro_clean_since "$t" 1 2>/dev/null && { echo "FAIL capture stops when the Metro log shows an ERROR"; fails=1; } || echo "PASS capture stops when the Metro log shows an ERROR"
  rm -f "$t"; exit $fails
fi

UDID=$1; LANG_=$2; OUT=$3; LOG=$4
[ -f "$LOG" ] || { echo "FAIL: Metro log not found: '$LOG'" >&2; exit 1; }
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
# REBOOT=springboard: restart only the home-screen process so the status bar takes the language (the
# iPad shows the date, which otherwise stays in the previous language); about 30 s. REBOOT=1 restarts
# the whole simulator instead.
if [ "${REBOOT:-}" = springboard ]; then
  timeout 30 xcrun simctl spawn "$UDID" launchctl kickstart -k user/foreground/com.apple.SpringBoard >/dev/null 2>&1 ||
    timeout 30 xcrun simctl spawn "$UDID" launchctl kickstart -k system/com.apple.SpringBoard >/dev/null 2>&1
  sleep 25
elif [ "${REBOOT:-}" = 1 ]; then
  timeout 60 xcrun simctl shutdown "$UDID" >/dev/null 2>&1
  timeout 120 xcrun simctl boot "$UDID" >/dev/null 2>&1
  timeout 180 xcrun simctl bootstatus "$UDID" >/dev/null 2>&1
  sleep 5
fi

# Some simulators ask "Open in My Expenses Book?" on every deep link: accept it when shown.
# OPEN_X/OPEN_Y tap the alert's Open button by position (system alerts are not in the app's tree).
accept() {
  # Soon after the link: if no alert came, the tap lands before the seeded screen opens (on the
  # empty detail pane or the launcher), never on a form field.
  sleep "${ACCEPT_WAIT:-1.2}"
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
start=$(wc -l < "$LOG" | tr -d ' ')
shot() { metro_clean_since "$LOG" "$start" || exit 1; timeout 30 axe screenshot --udid "$UDID" --output "$OUT/$1.png" >/dev/null 2>&1 && echo "  $1"; }
tap() { timeout 30 axe tap -x "$1" -y "$2" --udid "$UDID" >/dev/null 2>&1; }

# Centre of the first element matching: tab <name> (the tab-bar button) or row (a list row:
# "<day>, <merchant>, …"). Rows and tabs move with the layout and the language.
find_xy() {
  timeout 30 axe describe-ui --udid "$UDID" 2>/dev/null | python3 -c '
import json, re, sys
kind, name = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "")
def hit(e):
    l, r = e.get("AXLabel") or "", e.get("role") or ""
    if kind == "tab": return l == name and ("Radio" in r or "Tab" in r)
    if kind == "label": return l.startswith(name)
    return re.match(r"^\d+, ", l) is not None
def walk(e):
    if hit(e):
        f = e["frame"]; print(int(f["x"] + f["width"] / 2), int(f["y"] + f["height"] / 2)); sys.exit()
    for c in e.get("children") or []: walk(c)
for e in json.load(sys.stdin): walk(e)' "$@"
}
tap_found() { local xy; xy=$(find_xy "$@"); [ -n "$xy" ] && tap $xy; }
# HOME_ROW_X / TRIP_ROW_X / SEARCH_ROW_X: a position, or "first" for the first list row.
pick_row() { # <x or first> <y>
  if [ "$1" = first ]; then tap_found row; else tap "$1" "$2"; fi
}

want() { [ -z "${SHOTS:-}" ] || [[ " $SHOTS " == *" $1 "* ]]; }
echo "$LANG_ -> $OUT"
# axe rotate is relative: rotate only while the active display is still upright.
if [ "${ROTATE:-}" = landscape ] && timeout 30 axe displays --udid "$UDID" 2>/dev/null | grep -A0 '^Active' | grep -q portrait; then
  timeout 30 axe rotate left --udid "$UDID" >/dev/null 2>&1; sleep 4
fi
# After a restart the first link lands on the launcher or the splash: open the app once first.
[ -n "${REBOOT:-}" ] && fresh home
# Equal Y_SWIPE_FROM and Y_SWIPE_TO means no scroll (a zero-length swipe would be a tap).
want 01-review && { fresh review; [ "${Y_SWIPE_FROM:-700}" = "${Y_SWIPE_TO:-520}" ] || timeout 30 axe swipe --start-x "${X_MID:-220}" --start-y "${Y_SWIPE_FROM:-700}" --end-x "${X_MID:-220}" --end-y "${Y_SWIPE_TO:-520}" --udid "$UDID" >/dev/null 2>&1; sleep 3; shot 01-review; }
# HOME_ROW_X/Y (split layouts): select a receipt so the detail pane is not empty.
want 02-home && { fresh home; [ -n "${HOME_ROW_X:-}" ] && { pick_row "$HOME_ROW_X" "${HOME_ROW_Y:-}"; sleep 3; }; shot 02-home; }
# The full-screen viewer at fit: the whole receipt, sharp. (A 2.5x zoom cut every line in half.)
# X_PHOTO=photo: tap the receipt photo by its label (its place moves with the form's length).
want 03-zoom && { fresh review
  if [ "${X_PHOTO:-}" = photo ]; then tap_found label "$(i18n "$LANG_" review.openPhoto)"; else tap "${X_PHOTO:-${X_MID:-220}}" "${Y_PHOTO:-300}"; fi
  sleep 4; shot 03-zoom; }
want 04-stats && { fresh stats; shot 04-stats; }
want 05-trip && { fresh trip; [ -n "${TRIP_ROW_X:-}" ] && { pick_row "$TRIP_ROW_X" "${TRIP_ROW_Y:-}"; sleep 3; }; shot 05-trip; }
want 06-search && { fresh home; tap_found tab "$(label "$LANG_" search)"; sleep 3; tap "${X_FIELD:-180}" "${Y_FIELD:-117}"; sleep 2
timeout 30 axe type "$QUERY" --udid "$UDID" >/dev/null 2>&1; sleep 3
tap "${X_BLANK:-${X_MID:-220}}" "${Y_BLANK:-60}"; sleep 2
[ -n "${SEARCH_ROW_X:-}" ] && { pick_row "$SEARCH_ROW_X" "${SEARCH_ROW_Y:-}"; sleep 3; }
shot 06-search; }
