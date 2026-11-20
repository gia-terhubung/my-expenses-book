#!/usr/bin/env bash
# Repeat this: a confirmed receipt becomes a monthly rule. Saving adds no second expense (the
# receipt is today's occurrence), and Recurring lists the rule with "next" one month later.
source "$(dirname "$0")/lib.sh"
e2e_init "${1:-}" recurring

e2e_fresh
dev_clock 2026-11-20T03:00:00Z Asia/Jakarta

add_manual "Repeat Test Gym" "30"
tap "Save receipt"
assert_see "Repeat Test Gym"
[[ "$(count_labels "Repeat Test Gym")" == 1 ]] || fail "expected one Repeat Test Gym row before the rule"

tap_containing "Repeat Test Gym"
assert_see "Repeat this…"
shot receipt-detail
tap "Repeat this…"
assert_see "New recurring expense"
[[ "$(field_value Merchant)" == "Repeat Test Gym" ]] || fail "rule form not prefilled with the merchant"
[[ "$(field_value Amount)" == "30" ]] || fail "rule form not prefilled with the amount"
assert_see "Monthly"
shot rule-form
scroll_to "Save"
tap "Save"
# The receipt now belongs to the rule, so "Repeat this…" is gone.
assert_see "Repeat Test Gym"
assert_not_see "Repeat this…"

# No duplicate: still one row, also after a catch-up run (app back in the foreground).
tap "Back"
background_foreground
assert_see "Repeat Test Gym"
[[ "$(count_labels "Repeat Test Gym")" == 1 ]] || fail "duplicate Repeat Test Gym row after saving the rule"
shot home-no-duplicate

tap "Settings"
tap "Recurring"
assert_see "Repeat Test Gym, \$30.00, Monthly, next 20 Dec"
shot recurring-list

dev_clock
pass
