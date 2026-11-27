#!/usr/bin/env bash
# Tests for the Sunshine slide template and its renderer. Prints PASS/FAIL per case; exit 1 on any FAIL.
# Usage: tools/test-render.sh
set -u
cd "$(dirname "$0")/.."
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
fails=0
pass() { echo "PASS $1"; }
fail() { echo "FAIL $1: $2"; fails=$((fails + 1)); }
probe() { python3 tools/pngprobe.py "$@"; }

# iphone slide renders at size
out="$T/iphone.png"
if tools/render-one.sh appstore/iphone-6.9 en 03-month iphone raw/iphone/en/02-home.png 1320 2868 "$out" >"$T/log" 2>&1; then
  got=$(probe "$out")
  [ "$got" = "1320 2868 alpha=no" ] && pass "iphone slide renders at size" || fail "iphone slide renders at size" "$got"
  # page is yellow
  px=$(probe "$out" 20 1400 | tail -1)
  [ "$px" = "#FFD84A" ] && pass "page is yellow" || fail "page is yellow" "$px"
else
  fail "iphone slide renders at size" "$(tail -1 "$T/log")"
  fail "page is yellow" "no render"
fi

# caption overflow fails the render
long=$(python3 -c 'print("Lorem ipsum dolor sit amet " * 15)')
if CAPTION_OVERRIDE="$long" tools/render-one.sh appstore/iphone-6.9 en 03-month iphone raw/iphone/en/02-home.png 1320 2868 "$T/long.png" >"$T/log" 2>&1; then
  fail "caption overflow fails the render" "exit 0"
else
  grep -q "FAIL: overflow" "$T/log" && pass "caption overflow fails the render" || fail "caption overflow fails the render" "$(tail -1 "$T/log")"
fi

# raw aspect mismatch fails the render
if tools/render-one.sh appstore/duo-inner en 03-month duo-open raw/iphone/en/02-home.png 2007 2853 "$T/aspect.png" >"$T/log" 2>&1; then
  fail "raw aspect mismatch fails the render" "exit 0"
else
  grep -q "FAIL: aspect" "$T/log" && pass "raw aspect mismatch fails the render" || fail "raw aspect mismatch fails the render" "$(tail -1 "$T/log")"
fi

[ "$fails" -eq 0 ]
