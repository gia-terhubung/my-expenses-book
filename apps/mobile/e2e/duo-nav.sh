#!/usr/bin/env bash
# iPhone Duo only: native navigation in the side column (spec 2026-11-26-duo-native-navigation-design).
#
# A. Closed, upright: the four tabs work; Home floats its + and it opens Apple's menu.
# B. Closed, upright: a folder page has Back, Export, ⋯ and the + in the column.
# C. Closed, held sideways (short column): the folder page's ⋯ holds "Add receipt".
# D. Fold and unfold with the Filters sheet open: the sheet stays.
# E. Open, wide: tabs stay a tab bar (no sidebar list).
source "$(dirname "$0")/lib.sh"
e2e_init "${1:-}" duo-nav

posture closed
e2e_fresh

# --- A: tabs and Home's + ----------------------------------------------------------------------
tap "Search";   assert_see "Filters"
tap "Folders";  assert_see "New folder"
tap "Settings"; assert_see "Recurring"
tap "Receipts"
tap "Add receipt"
assert_see "Scan receipt"
assert_see "Import from Photos"
assert_see "Add manually"
shot home-plus-menu
_tap_point 120 420 # closes the menu (tap on the empty feed)
sleep 1

# --- B: folder page header in the column --------------------------------------------------------
tap "Folders"
tap_containing "New folder"
fill "Folder name" "Bali"
# Return in the name field may already create it; then there is no Create to tap.
sleep 1; see "Create" && tap "Create"
assert_see "Bali"
tap_containing "Bali"
assert_see "Back"
assert_see "Export"
assert_see "More"
assert_see "Add receipt"
shot folder-header-column

# --- C: short column (held sideways) ------------------------------------------------------------
rotate left
assert_see "More"
assert_not_see "Export" 2
tap "More"
assert_see "Add receipt"
assert_see "Export"
shot folder-short-column-more
_tap_point 120 300 # closes the menu
sleep 1
rotate right

# --- D: fold and unfold with a sheet open --------------------------------------------------------
tap "Back"
tap "Search"
tap "Filters"
assert_see "Apply"
posture open
assert_see "Apply"
shot open-filters-kept
posture closed
assert_see "Apply"
tap "Cancel"

# --- E: open, wide: tab bar, not a sidebar -------------------------------------------------------
posture open
assert_see "Receipts"
assert_see "Settings"
assert_not_see "Show Sidebar" 2
shot open-tab-bar

posture closed
pass
