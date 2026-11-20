#!/usr/bin/env bash
# Catch-up and Undo: a monthly rule made on 20 Nov; the dev clock moves to 20 Feb (3 months
# ahead) and the app comes back to the foreground. The banner reads "Added 3 recurring
# expenses."; Undo removes them and the feed is back to its earlier count.
#
# The dev clock lives in memory, so a cold start would drop it. The flow sends the app to the
# background and back instead: catch-up runs on AppState -> active as it does on launch.
source "$(dirname "$0")/lib.sh"
e2e_init "${1:-}" catchup-undo

e2e_fresh
dev_clock 2026-11-20T03:00:00Z Asia/Jakarta

add_manual "Catchup Test Rent" "100"
tap "Save receipt"
tap_containing "Catchup Test Rent"
tap "Repeat this…"
assert_see "New recurring expense"
scroll_to "Save"
tap "Save"
assert_not_see "Repeat this…"
tap "Back"

before="$(count_labels "Catchup Test Rent")"
[[ "$before" == 1 ]] || fail "expected 1 row before catch-up, saw $before"
shot before

dev_clock 2027-02-20T03:00:00Z Asia/Jakarta
background_foreground
assert_see "Added 3 recurring expenses."
after="$(count_labels "Catchup Test Rent")"
[[ "$after" == 4 ]] || fail "expected 4 rows after catch-up, saw $after"
log "rows: $before before, $after after catch-up"
shot banner-added-3

tap "Undo"
assert_see "Removed 3 recurring expenses."
assert_not_see "Added 3 recurring expenses." 1
undone="$(count_labels "Catchup Test Rent")"
[[ "$undone" == "$before" ]] || fail "expected $before rows after Undo, saw $undone"
log "rows after Undo: $undone"
shot after-undo

dev_clock
pass
