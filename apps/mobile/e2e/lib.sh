#!/usr/bin/env bash
# Shared helpers for the end-to-end flows in this folder. Source it from a flow:
#
#   source "$(dirname "$0")/lib.sh"; e2e_init "$1" "payday"
#
# Every helper goes through a small platform layer (_ui_dump, _tap_label, _type, _shot, ...).
# Only iOS simulators (AXe + xcrun simctl) are implemented. An Android variant adds the
# `android` branches (adb + `uiautomator dump`) and sets E2E_PLATFORM=android; the flows stay
# unchanged because they only call the e2e_* / tap / see helpers below.
set -euo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$E2E_DIR/.." && pwd)"
EVIDENCE_DIR="${E2E_EVIDENCE_DIR:-$(cd "$APP_DIR/../.." && pwd)/docs/v1-recurring-evidence}"
BUNDLE_ID="${E2E_BUNDLE_ID:-com.terhubung.myexpensesbook}"
SCHEME="${E2E_SCHEME:-myexpensesbook}"
E2E_PLATFORM="${E2E_PLATFORM:-ios}"
WAIT_SECS="${E2E_WAIT_SECS:-15}"
AXE="${AXE:-axe}"

UDID=""
FLOW=""
DEVICE_TAG=""
STEP=0

e2e_init() {
  UDID="${1:-}"
  FLOW="$2"
  if [[ -z "$UDID" ]]; then
    echo "usage: $0 <device-udid>" >&2
    exit 64
  fi
  case "$E2E_PLATFORM" in
    ios)
      command -v "$AXE" >/dev/null || { echo "AXe not found (brew install cameroncooke/axe/axe)" >&2; exit 69; }
      DEVICE_TAG="$(xcrun simctl list devices | grep "$UDID" | sed -E 's/^ *([^(]+) \(.*/\1/' | tr -d ' ' | tr 'A-Z' 'a-z')"
      ;;
    *) _unsupported ;;
  esac
  DEVICE_TAG="${DEVICE_TAG:-device}"
  require_wipe_allowed
  mkdir -p "$EVIDENCE_DIR"
  log "flow $FLOW on $DEVICE_TAG ($UDID)"
}

log() { printf '[%s %s] %s\n' "$(date +%H:%M:%S)" "${FLOW:-e2e}" "$*"; }

fail() {
  log "FAIL: $*"
  shot "FAILED" || true
  exit 1
}

pass() { log "PASS"; }

_unsupported() {
  echo "E2E_PLATFORM=$E2E_PLATFORM is not implemented yet (only ios)" >&2
  exit 70
}

# ---- platform layer -------------------------------------------------------------------------

# Prints the accessibility tree as JSON.
_ui_dump() {
  case "$E2E_PLATFORM" in
    ios) "$AXE" describe-ui --udid "$UDID" 2>/dev/null ;;
    *) _unsupported ;;
  esac
}

# Taps the first element whose label is exactly $1 (optionally of accessibility type $2).
_tap_label() {
  case "$E2E_PLATFORM" in
    ios) "$AXE" tap --label "$1" ${2:+--element-type "$2"} --udid "$UDID" >/dev/null 2>&1 ;;
    *) _unsupported ;;
  esac
}

# Taps the element with accessibility identifier (testID) $1.
_tap_id() {
  case "$E2E_PLATFORM" in
    ios) "$AXE" tap --id "$1" --udid "$UDID" >/dev/null 2>&1 ;;
    *) _unsupported ;;
  esac
}

_tap_point() {
  case "$E2E_PLATFORM" in
    ios) "$AXE" tap -x "$1" -y "$2" --udid "$UDID" >/dev/null ;;
    *) _unsupported ;;
  esac
}

_type() {
  case "$E2E_PLATFORM" in
    ios) "$AXE" type "$1" --udid "$UDID" >/dev/null ;;
    *) _unsupported ;;
  esac
}

_shot() {
  case "$E2E_PLATFORM" in
    ios) "$AXE" --output json screenshot --udid "$UDID" --output "$1" >/dev/null ;;
    *) _unsupported ;;
  esac
}

_open_url() {
  case "$E2E_PLATFORM" in
    ios) xcrun simctl openurl "$UDID" "$1" ;;
    *) _unsupported ;;
  esac
}

_launch() {
  case "$E2E_PLATFORM" in
    ios) xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null ;;
    *) _unsupported ;;
  esac
}

_terminate() {
  case "$E2E_PLATFORM" in
    ios) xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true ;;
    *) _unsupported ;;
  esac
}

# Clears the focused text field (select all, delete).
_clear_field() {
  case "$E2E_PLATFORM" in
    ios)
      "$AXE" key-combo --modifiers 227 --key 4 --udid "$UDID" >/dev/null # Cmd+A
      "$AXE" key 42 --udid "$UDID" >/dev/null                            # Backspace
      sleep 0.3
      ;;
    *) _unsupported ;;
  esac
}

# Foldables: posture closed|open (iPhone Duo hinge via AXe).
_posture() {
  case "$E2E_PLATFORM" in
    ios) "$AXE" hinge set "$1" --udid "$UDID" >/dev/null ;;
    *) _unsupported ;;
  esac
}

_rotate() {
  case "$E2E_PLATFORM" in
    ios) "$AXE" rotate "$1" --udid "$UDID" >/dev/null ;;
    *) _unsupported ;;
  esac
}

# Drags the content up by about half a screen (reveals what is below).
_scroll_down() {
  case "$E2E_PLATFORM" in
    ios)
      local h; h="$(screen_height)"
      "$AXE" swipe --start-x 190 --start-y $((h * 7 / 10)) --end-x 190 --end-y $((h * 3 / 10)) --udid "$UDID" >/dev/null
      sleep 0.6
      ;;
    *) _unsupported ;;
  esac
}

# Hides the keyboard (Return ends editing in a one-line field).
_dismiss_keyboard() {
  case "$E2E_PLATFORM" in
    ios) "$AXE" key 40 --udid "$UDID" >/dev/null; sleep 0.5 ;;
    *) _unsupported ;;
  esac
}

_home() {
  case "$E2E_PLATFORM" in
    ios) "$AXE" button home --udid "$UDID" >/dev/null ;;
    *) _unsupported ;;
  esac
}

# ---- queries over the accessibility tree ------------------------------------------------------

# Prints every element as "label<TAB>value<TAB>centerX<TAB>centerY", one per line.
ui_elements() {
  _ui_dump | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
def walk(node):
    if isinstance(node, list):
        for n in node: walk(n)
        return
    if not isinstance(node, dict): return
    label = node.get("AXLabel") or node.get("label") or ""
    value = node.get("AXValue") or node.get("value") or ""
    f = node.get("frame") or {}
    x = f.get("x", 0) + f.get("width", 0) / 2
    y = f.get("y", 0) + f.get("height", 0) / 2
    if label or value:
        print("%s\t%s\t%d\t%d" % (str(label).replace("\n", " "), str(value).replace("\n", " "), x, y))
    for key in ("children", "elements"):
        if key in node: walk(node[key])
walk(data)
'
}

# Height of the app window in points.
screen_height() {
  _ui_dump | python3 -c '
import json, sys
d = json.load(sys.stdin)
d = d[0] if isinstance(d, list) else d
print(int((d.get("frame") or {}).get("height", 600)))
'
}

# Scrolls down until an element labelled $1 is inside the window.
scroll_to() {
  local text="$1" i xy h
  h="$(screen_height)"
  for i in 1 2 3 4 5 6 7 8; do
    xy="$(exact_center_of "$text")"
    if [[ -n "$xy" ]] && ((${xy#* } > 40 && ${xy#* } < h - 30)); then return 0; fi
    _scroll_down
  done
  fail "could not scroll to \"$text\""
}

# True when some element's label or value contains $1 (fixed string).
see() { ui_elements | cut -f1,2 | grep -qF -- "$1"; }

# Waits up to ${2:-WAIT_SECS} seconds for $1 to show.
wait_for() {
  local text="$1" secs="${2:-$WAIT_SECS}" end=$((SECONDS + ${2:-$WAIT_SECS}))
  while ((SECONDS < end)); do
    see "$text" && return 0
    sleep 0.5
  done
  return 1
}

assert_see() { wait_for "$1" "${2:-$WAIT_SECS}" || fail "expected to see \"$1\""; log "sees \"$1\""; }

# Fails if $1 is still on screen after ${2:-2} seconds.
assert_not_see() {
  sleep "${2:-2}"
  see "$1" && fail "did not expect to see \"$1\""
  log "does not see \"$1\""
}

# Prints the centre "x y" of the first element whose label or value is exactly $1.
exact_center_of() {
  ui_elements | awk -F'\t' -v t="$1" '$1 == t || $2 == t { print $3, $4; exit }'
}

# Prints the centre "x y" of the first element whose label or value contains $1.
center_of() {
  ui_elements | awk -F'\t' -v t="$1" 'index($1, t) || index($2, t) { print $3, $4; exit }'
}

# Counts elements whose label contains $1.
count_labels() { ui_elements | cut -f1 | grep -cF -- "$1" || true; }

# ---- actions ----------------------------------------------------------------------------------

# Taps the text field labelled $1 (not its caption) and types $2, then reads the field back.
# Keys sent right after focus can land out of order, so a wrong value is cleared and retyped
# (up to 3 tries).
fill() {
  local label="$1" text="$2" try got=""
  for try in 1 2 3; do
    wait_for "$label" || fail "no text field \"$label\""
    _tap_label "$label" TextField || { sleep 0.5; continue; }
    sleep 0.8
    if [[ -n "$(field_value "$label")" ]]; then _clear_field; fi
    type_text "$text"
    for _ in 1 2 3 4; do
      got="$(field_value "$label")"
      # Hide the keyboard: the review form's floating Save/Discard bar sits over fields above it.
      [[ "$got" == "$text" ]] && { _dismiss_keyboard; return 0; }
      sleep 0.5
    done
    log "field \"$label\" reads \"$got\" (try $try), retyping"
  done
  fail "field \"$label\" reads \"$got\", not \"$text\""
}

# Taps the element labelled exactly $1 (or, for text fields, whose value/placeholder is $1),
# waiting and retrying until it is there.
tap() {
  local text="$1" end=$((SECONDS + WAIT_SECS)) xy
  while ((SECONDS < end)); do
    if _tap_label "$text"; then
      log "tap \"$text\""
      sleep 0.6
      return 0
    fi
    xy="$(exact_center_of "$text")"
    if [[ -n "$xy" ]]; then
      # shellcheck disable=SC2086
      _tap_point $xy
      log "tap \"$text\" at $xy"
      sleep 0.6
      return 0
    fi
    sleep 0.5
  done
  fail "could not tap \"$text\""
}

# Taps the element whose testID is $1 (switches, which a label tap may miss).
tap_id() {
  local id="$1" end=$((SECONDS + WAIT_SECS))
  while ((SECONDS < end)); do
    if _tap_id "$id"; then
      log "tap #$id"
      sleep 0.6
      return 0
    fi
    sleep 0.5
  done
  fail "could not tap #$id"
}

# Taps the first element whose label or value contains $1 (for labels with dynamic parts).
tap_containing() {
  local text="$1" end=$((SECONDS + WAIT_SECS)) xy
  while ((SECONDS < end)); do
    xy="$(center_of "$text")"
    if [[ -n "$xy" ]]; then
      # shellcheck disable=SC2086
      _tap_point $xy
      log "tap containing \"$text\" at $xy"
      sleep 0.6
      return 0
    fi
    sleep 0.5
  done
  fail "nothing containing \"$text\" to tap"
}

# Taps the last element labelled exactly $1 (the topmost one, e.g. a confirm sheet's button).
tap_last() {
  local text="$1" end=$((SECONDS + WAIT_SECS)) xy
  while ((SECONDS < end)); do
    xy="$(ui_elements | awk -F'\t' -v t="$1" '$1 == t { xy = $3 " " $4 } END { print xy }')"
    if [[ -n "$xy" ]]; then
      # shellcheck disable=SC2086
      _tap_point $xy
      log "tap last \"$text\" at $xy"
      sleep 0.6
      return 0
    fi
    sleep 0.5
  done
  fail "nothing labelled \"$text\" to tap"
}

# Types $1 a few characters at a time: a controlled React Native field drops keys typed in one burst.
type_text() {
  local text="$1" i
  for ((i = 0; i < ${#text}; i += 3)); do
    _type "${text:i:3}"
    sleep 0.15
  done
  log "type \"$text\""
  sleep 0.3
}

# Prints the value of the text field labelled $1.
field_value() {
  _ui_dump | python3 -c '
import json, sys
want = sys.argv[1]
def walk(n):
    if isinstance(n, list):
        for x in n: walk(x)
        return
    if n.get("type") == "TextField" and n.get("AXLabel") == want:
        print(n.get("AXValue") or ""); sys.exit(0)
    walk(n.get("children", []))
walk(json.load(sys.stdin))
' "$1"
}

# Saves a screenshot as <flow>-<device>-<NN>-<name>.png in the evidence folder.
shot() {
  STEP=$((STEP + 1))
  local file
  file="$EVIDENCE_DIR/$(printf '%s-%s-%02d-%s.png' "$FLOW" "$DEVICE_TAG" "$STEP" "$1")"
  _shot "$file"
  log "screenshot $(basename "$file")"
}

open_url() { _open_url "$1"; log "open $1"; sleep 1.5; }

posture() { _posture "$1"; log "posture $1"; sleep 1.5; }
rotate() { _rotate "$1"; log "rotate $1"; sleep 1.5; }

# Sets the dev clock (dev builds only): dev_clock <iso-instant> [IANA zone]; no args resets it.
dev_clock() {
  if [[ $# -eq 0 ]]; then
    open_url "$SCHEME://dev/clock?reset=1"
  else
    open_url "$SCHEME://dev/clock?now=$1${2:+&tz=$2}"
  fi
  # The dev screen applies the clock, then replaces itself with Home; wait for that to settle.
  local end=$((SECONDS + WAIT_SECS))
  while ((SECONDS < end)); do
    see "Dev clock: invalid" && fail "dev clock rejected the params"
    if ! see "Dev clock:" && see "Add receipt"; then
      sleep 1
      return 0
    fi
    sleep 0.5
  done
  fail "dev clock did not return to Home"
}

# Cold start. In-memory state (the dev clock) is gone afterwards.
relaunch() {
  _terminate
  sleep 1
  _launch
  log "relaunched $BUNDLE_ID"
  wait_for "Receipts" 90 || fail "app did not come back after relaunch"
}

# Sends the app to the background and back (AppState -> active), keeping in-memory state.
background_foreground() {
  _home
  sleep 1.5
  _launch
  log "background -> foreground"
  sleep 2
}

BACKUP_ROOT="${E2E_BACKUP_ROOT:-$HOME/MEB-e2e-backups}"

# Every flow wipes the app's data; stop before touching the device unless E2E_ALLOW_WIPE=1.
require_wipe_allowed() {
  if [[ "${E2E_ALLOW_WIPE:-}" != 1 ]]; then
    echo "Refusing to wipe the app's data on $UDID: the flows delete its database and prefs." >&2
    echo "Run with E2E_ALLOW_WIPE=1 to allow it (Documents/ is backed up to $BACKUP_ROOT first)." >&2
    exit 65
  fi
}

# Wipes the app's database and prefs (Documents/SQLite, Documents/mmkv on iOS). The keychain
# master key and the dev client's own state are kept, so the app starts at onboarding.
# Refuses unless E2E_ALLOW_WIPE=1. Before wiping it copies the whole Documents/ folder to
# $BACKUP_ROOT/<UDID>/<timestamp>/Documents (outside the repo) and prints that path; put it
# back with restore_app_data.
reset_app_data() {
  require_wipe_allowed
  case "$E2E_PLATFORM" in
    ios)
      _terminate
      local data backup
      data="$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data)"
      backup="$BACKUP_ROOT/$UDID/$(date +%Y%m%d-%H%M%S)"
      mkdir -p "$backup"
      cp -a "$data/Documents" "$backup/" || fail "backup to $backup failed; nothing was wiped"
      log "backed up app data to $backup"
      rm -rf "${data:?}/Documents/SQLite" "${data:?}/Documents/mmkv"
      log "app data wiped (restore: restore_app_data $UDID $backup)"
      ;;
    *) _unsupported ;;
  esac
}

# Puts back a backup made by reset_app_data: restore_app_data <UDID> <backup-dir>, where
# <backup-dir> is the printed $BACKUP_ROOT/<UDID>/<timestamp> folder. Replaces the app's
# Documents/SQLite and Documents/mmkv with the backup's copies.
restore_app_data() {
  local udid="$1" backup="$2" data
  [[ -n "$udid" && -d "$backup/Documents" ]] || { echo "usage: restore_app_data <UDID> <backup-dir with Documents/>" >&2; return 64; }
  case "$E2E_PLATFORM" in
    ios)
      xcrun simctl terminate "$udid" "$BUNDLE_ID" >/dev/null 2>&1 || true
      data="$(xcrun simctl get_app_container "$udid" "$BUNDLE_ID" data)"
      rm -rf "${data:?}/Documents/SQLite" "${data:?}/Documents/mmkv"
      cp -a "$backup/Documents/." "$data/Documents/"
      echo "restored $backup into $udid"
      ;;
    *) _unsupported ;;
  esac
}

# Fresh app on Home: wipe data, launch (the dev client loads the bundle from Metro), finish
# onboarding with English, USD and no app lock.
e2e_fresh() {
  reset_app_data
  _launch
  log "launched $BUNDLE_ID"
  wait_for "Choose your language" 90 || fail "onboarding did not appear (is Metro running?)"
  tap "English"
  tap "Next"
  wait_for "Choose your home currency" || fail "no currency step"
  # Keys right after focus can drop; retype until the USD option is listed.
  local try
  tap "Search"
  sleep 0.8
  for try in 1 2 3; do
    # Lower case: a shifted key is the one most often dropped. The search ignores case.
    type_text "usd"
    sleep 0.5
    ui_elements | awk -F'\t' '$1 == "USD" && $2 ~ /radio/ { found = 1 } END { exit !found }' && break
    log "currency search did not list USD (try $try)"
    see "Clear text" && _tap_label "Clear text"
    sleep 0.5
  done
  _dismiss_keyboard # it can cover Next
  tap "USD"
  tap "Next"
  tap "Not now"
  assert_see "No receipts yet"
}

# Adds a manual receipt from Home (dated by the app clock): add_manual <merchant> <total>.
add_manual() {
  tap "Add receipt"
  tap_last "Add manually"
  wait_for "Review receipt" || fail "review form did not open"
  fill "Merchant" "$1"
  fill "Total" "$2"
}
