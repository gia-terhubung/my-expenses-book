#!/usr/bin/env bash
# iPhone Duo only: the rule form keeps what was typed across fold, unfold and rotation.
#
# A. Brief scenario: form opened while closed (pushed, one pane), amount typed, then opened.
#    The pushed form stays full width with the typed values (accepted for 1.0, ruling T9);
#    the flow checks the values and records which layout it saw.
# B. The two-pane path: in the open posture the form opens in the right pane; fold shows the
#    form alone, unfold puts the list back beside it, open portrait shows one pane. The typed
#    amount survives every step.
source "$(dirname "$0")/lib.sh"
e2e_init "${1:-}" duo-fold

posture closed
e2e_fresh

# --- A: closed -> open ------------------------------------------------------------------------
tap "Settings"
tap "Recurring"
tap "Add a recurring expense"
assert_see "New recurring expense"
fill "Merchant" "Fold Test Phone"
fill "Amount" "45.75"
shot closed-form-typed

posture open
assert_see "New recurring expense"
[[ "$(field_value Amount)" == "45.75" ]] || fail "amount lost after unfolding (reads \"$(field_value Amount)\")"
[[ "$(field_value Merchant)" == "Fold Test Phone" ]] || fail "merchant lost after unfolding"
if see "No recurring expenses yet"; then layout="two panes (form right)"; else layout="pushed form, full width"; fi
log "A: typed values kept after unfolding; layout: $layout"
shot open-pushed-form-kept

# --- B: open (two panes) -> closed -> open -> open portrait ------------------------------------
tap "Back"
assert_see "Choose a recurring expense to change it, or add a new one."
tap "Add a recurring expense"
fill "Merchant" "Fold Test Phone"
fill "Amount" "45.75"
assert_see "No recurring expenses yet" # list still on the left
shot open-two-panes

posture closed
assert_see "New recurring expense"
assert_not_see "No recurring expenses yet" 1
[[ "$(field_value Amount)" == "45.75" ]] || fail "amount lost after folding"
shot closed-form-alone

posture open
assert_see "No recurring expenses yet"
assert_see "New recurring expense"
[[ "$(field_value Amount)" == "45.75" ]] || fail "amount lost after unfolding again"
shot open-two-panes-again

rotate left
assert_see "New recurring expense"
[[ "$(field_value Amount)" == "45.75" ]] || fail "amount lost in open portrait"
shot open-portrait
rotate right

posture closed
pass
