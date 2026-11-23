#!/usr/bin/env bash
# R1 / E7: the notification permission is asked when the first draft-type rule is saved, never
# for an auto-add rule. Needs an install where the permission was never asked (fresh install,
# or Android with POST_NOTIFICATIONS not yet user-set). Android only: it reads the system
# permission dialog from the uiautomator dump. On iOS run E7 by hand.
source "$(dirname "$0")/lib.sh"
e2e_init "${1:-}" notify-prompt
[[ "$E2E_PLATFORM" == android ]] || { echo "notify-prompt: Android only (iOS: E7 by hand)" >&2; exit 64; }

PROMPT="to send you notifications"

e2e_fresh
tap "Settings"
tap "Recurring"

# 1. Auto-add rule (the form's default): saving it asks nothing.
tap "Add a recurring expense"
assert_see "New recurring expense"
fill "Merchant" "Prompt Test Wifi"
fill "Amount" "25"
shot auto-rule-form
scroll_to "Save"
tap "Save"
assert_see "Prompt Test Wifi"
assert_not_see "$PROMPT" 3
shot after-auto-rule-no-prompt

# 2. Draft-type rule ("Add automatically" off): the system prompt shows on save.
tap "New"
assert_see "New recurring expense"
fill "Merchant" "Prompt Test Gym"
fill "Amount" "30"
scroll_to "Add automatically"
tap_id "rule-auto-add"
scroll_to "Save"
shot draft-rule-form
tap "Save"
assert_see "$PROMPT"
shot draft-rule-prompt
tap "Allow"
assert_see "Prompt Test Gym"
shot after-allow-list
pass
