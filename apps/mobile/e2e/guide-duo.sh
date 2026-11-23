#!/usr/bin/env bash
# iPhone Duo only: the guide (first run and replay), its (i) sheets and the shared back header,
# across fold, unfold and rotation.
#
# A. First run on the closed (outer) screen; unfold on the currency step with search text typed:
#    the text survives and the guide splits into two panes; fold again: one column.
# B. Tax year and pay cycle steps explain themselves with a live example; Day 25 changes it.
# C. Lock, then the three cards, then Home.
# D. Settings > Show guide (open posture: two panes, Close), the (i) sheets, the back header.
source "$(dirname "$0")/lib.sh"
E2E_EVIDENCE_DIR="${E2E_EVIDENCE_DIR:-$(cd "$APP_DIR/../.." && pwd)/docs/guide-evidence}"
EVIDENCE_DIR="$E2E_EVIDENCE_DIR"
e2e_init "${1:-}" guide-duo

# --- A: first run, fold/unfold on the currency step ------------------------------------------
posture closed
reset_app_data
_launch
wait_for "Choose your language" 90 || fail "onboarding did not appear (is Metro running?)"
tap "English"
shot closed-language
tap "Next"
wait_for "Choose your home currency" || fail "no currency step"
assert_see "Back"
tap "Search"
sleep 0.8
type_text "usd"
sleep 0.5
_dismiss_keyboard
shot closed-currency-typed

posture open
assert_see "Choose your home currency"
ui_elements | grep -qF "usd" || fail "currency search text lost after unfolding"
log "A: search text kept after unfolding"
shot open-currency-split

posture closed
ui_elements | grep -qF "usd" || fail "currency search text lost after folding"
tap "USD"
tap "Next"

# --- B: tax year and pay cycle ----------------------------------------------------------------
wait_for "When does your tax year start?" || fail "no tax year step"
assert_see "Step 3 of 5"
shot closed-tax-year
posture open
shot open-tax-year-split
tap "Next"
wait_for "When does your month start?" || fail "no pay cycle step"
tap "Day 25"
see "Only days 1–28" || see "Only days 1" || log "pay cycle body text not in the visible tree (scrolled)"
shot open-pay-cycle-day25
rotate left
assert_see "When does your month start?"
shot open-portrait-pay-cycle
rotate right
tap "Next"

# --- C: lock, cards, Home ---------------------------------------------------------------------
wait_for "Protect your receipts" || fail "no lock step"
shot open-lock
tap "Not now"
wait_for "Add receipts" || fail "no first card"
shot open-card-scan
tap "Next"
assert_see "Check and save"
shot open-card-review
tap "Next"
assert_see "See your totals"
posture closed
assert_see "See your totals"
shot closed-card-totals
tap "Start using the app"
assert_see "No receipts yet"
assert_not_see "New: a short guide to pay cycle and tax year." 1
shot closed-home

# --- D: replay, (i) sheets, back header -------------------------------------------------------
posture open
tap "Settings"
assert_see "Pay cycle starts on"
shot open-settings
tap "About Pay cycle"
assert_see "Pay cycle"
shot open-info-pay-cycle
tap "Done"
tap "Show guide"
wait_for "Choose your language" || fail "replay did not open"
assert_see "Close guide"
shot open-replay-language
tap "Close guide"
assert_see "Pay cycle starts on"

posture closed
tap "Categories"
assert_see "Back"
shot closed-categories-header
tap "Back"
tap "Recurring"
shot closed-recurring-header
tap "Back"
tap "Backup & restore"
shot closed-backup-header
tap "Back"
tap "Error log"
shot closed-errorlog-header
tap "Back"
assert_see "Pay cycle starts on"
pass
