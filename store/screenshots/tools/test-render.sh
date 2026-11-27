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

# A solid PNG of a given size (stands in for captures that do not exist yet).
solid() { python3 - "$1" "$2" "$3" <<'PY'
import struct, sys, zlib
w, h, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
row = b"\x00" + bytes([120, 200, 170]) * w
chunk = lambda k, d: struct.pack(">I", len(d)) + k + d + struct.pack(">I", zlib.crc32(k + d) & 0xFFFFFFFF)
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(row * h)) + chunk(b"IEND", b"")
open(out, "wb").write(png)
PY
}

# marks: the shape details each device frame draws (read from the page, data-marks)
marks_of() { # device raw w h
  python3 -c '
import os,sys,urllib.parse as u
dev,raw,w,h=sys.argv[1:5]
print("file://"+os.path.abspath("tools/slide/slide.html")+"?"+u.urlencode({"w":w,"h":h,"device":dev,"caption":"Hi","raw":"file://"+os.path.abspath(raw)}))' "$@" |
  { read -r url; "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --allow-file-access-from-files --virtual-time-budget=5000 "--window-size=$3,$4" --dump-dom "$url" 2>/dev/null; } |
  sed -n 's/.*data-marks="\([a-z ]*\)".*/\1/p' | head -1
}

# every device frame renders at its store size
solid 360 820 "$T/android.png"      # Redmi 720 x 1640
solid 516 688 "$T/ipad.png"         # iPad 2064 x 2752
solid 466 678 "$T/duo-closed.png"   # Duo outer 1398 x 2034
solid 951 669 "$T/duo-open.png"     # Duo inner held sideways 2853 x 2007
while read -r target device raw w h; do
  out="$T/$device.out.png"
  if tools/render-one.sh "$target" en 03-month "$device" "$raw" "$w" "$h" "$out" >"$T/log" 2>&1; then
    got=$(probe "$out")
    [ "$got" = "$w $h alpha=no" ] && pass "$device frame renders" || fail "$device frame renders" "$got"
  else
    fail "$device frame renders" "$(tail -1 "$T/log")"
  fi
done <<LIST
play/phone android $T/android.png 1080 1920
appstore/ipad-13 ipad $T/ipad.png 2064 2752
play/tablet tablet $T/ipad.png 1440 2560
appstore/duo-outer duo-closed $T/duo-closed.png 1398 2034
appstore/duo-inner duo-open $T/duo-open.png 2007 2853
LIST

while read -r device raw w h want; do
  got=$(marks_of "$device" "$raw" "$w" "$h")
  [ "$got" = "$want" ] && pass "$device frame shape: ${want:-plain}" || fail "$device frame shape" "got '$got', want '$want'"
done <<LIST
iphone raw/iphone/en/02-home.png 1320 2868 island
android $T/android.png 1080 1920 punch
ipad $T/ipad.png 2064 2752 camera
tablet $T/ipad.png 1440 2560 plain
duo-closed $T/duo-closed.png 1398 2034 spine
duo-open $T/duo-open.png 2007 2853 fold
LIST

# receipt slides (00-free, 01-private) render from their slips
while read -r slide slip lang w h; do
  out="$T/$slide-$lang-$w.png"
  if tools/render-one.sh test "$lang" "$slide" receipt "$slip" "$w" "$h" "$out" >"$T/log" 2>&1; then
    got=$(probe "$out")
    [ "$got" = "$w $h alpha=no" ] && pass "$slide $lang $w x $h renders" || fail "$slide $lang $w x $h renders" "$got"
  else
    fail "$slide $lang $w x $h renders" "$(tail -1 "$T/log")"
  fi
done <<LIST
00-free zero-receipt.json en 1320 2868
00-free zero-receipt.json pt-BR 2007 2853
01-private private-receipt.json en 2007 2853
01-private private-receipt.json pt-BR 1320 2868
LIST

# Play feature graphic: 1024 x 500, yellow, new copy that says what the app is
for lang in en id es pt-BR; do
  out="$T/feature-$lang.png"
  if PAGE=tools/slide/feature.html tools/render-one.sh play/feature "$lang" feature receipt zero-receipt.json 1024 500 "$out" >"$T/log" 2>&1; then
    got=$(probe "$out" 12 12 | tr '\n' ' ')
    [ "$got" = "1024 500 alpha=no #FFD84A " ] && pass "feature $lang" || fail "feature $lang" "$got"
  else
    fail "feature $lang" "$(tail -1 "$T/log")"
  fi
done
python3 -c 'import json,sys; c=json.load(open("captions.json"))["feature"]; sys.exit(0 if c["en"].startswith("Scan receipts and see where your money goes.") else 1)' &&
  pass "feature copy says what the app is" || fail "feature copy says what the app is" "captions.json feature.en"

[ "$fails" -eq 0 ]
