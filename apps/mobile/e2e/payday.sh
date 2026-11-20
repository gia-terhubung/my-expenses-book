#!/usr/bin/env bash
# Payday month: Month starts on Day 25. A receipt dated 26 Oct counts in the period that is
# current on 20 Nov, and Stats shows the range "25 Oct – 24 Nov".
# The dev clock pins "today" so the expected strings never depend on the run date.
source "$(dirname "$0")/lib.sh"
e2e_init "${1:-}" payday

e2e_fresh

# Settings > Month starts on > Day 25.
tap "Settings"
tap_containing "Month starts on"
tap "Day 25"
tap "Done"
assert_see "Month starts on, Day 25"
shot settings-day25

# A manual receipt dated the 26th of last month (the app clock sets a manual draft's date).
tap "Receipts"
dev_clock 2026-10-26T03:00:00Z Asia/Jakarta
add_manual "Payday Test Cafe" "12.50"
shot receipt-26-oct
tap "Save receipt"
assert_see "Payday Test Cafe"

# Back to "today" = 20 Nov: Home's "This month" is the pay period 25 Oct – 24 Nov.
dev_clock 2026-11-20T03:00:00Z Asia/Jakarta
assert_see "This month, \$12.50"
assert_see "Payday Test Cafe"
shot home-this-period

tap_containing "See statistics"
assert_see "25 Oct – 24 Nov"
assert_see "\$12.50"
shot stats-range

dev_clock
pass
