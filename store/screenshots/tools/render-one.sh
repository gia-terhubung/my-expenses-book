#!/usr/bin/env bash
# Renders one store slide from tools/slide/slide.html with headless Chrome and writes it as a PNG
# with no alpha channel at exactly w x h.
# Usage: tools/render-one.sh <target> <lang> <slide> <device> <raw> <w> <h> <out.png>
#   target  out/ folder name, e.g. appstore/iphone-6.9 (only used in messages)
#   slide   caption key in captions.json, e.g. 03-month
#   raw     capture shown on the device (path relative to store/screenshots); for device "receipt",
#           the slip JSON (zero-receipt.json, private-receipt.json) whose <lang> lines are printed
# CAPTION_OVERRIDE replaces the caption text (tests). PAGE overrides the template (default slide.html).
# Prints "FAIL: <status>" and exits 1 when the page reports anything but ok.
set -u
cd "$(dirname "$0")/.."
TARGET=$1 LANG_=$2 SLIDE=$3 DEVICE=$4 RAW=$5 W=$6 H=$7 OUT=$8
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FLATTEN=out/.flatten
mkdir -p out "$(dirname "$OUT")"
[ "$FLATTEN" -nt tools/flatten.swift ] || swiftc -O tools/flatten.swift -o "$FLATTEN"

caption=${CAPTION_OVERRIDE:-$(python3 -c 'import json,sys; print(json.load(open("captions.json"))[sys.argv[1]][sys.argv[2]])' "$SLIDE" "$LANG_")}
url=$(python3 -c '
import json, os, sys, urllib.parse as u
page, raw, cap, dev, w, h, lang = sys.argv[1:8]
q = {"w": w, "h": h, "device": dev, "caption": cap}
if os.environ.get("MARKS"):
    q["marks"] = os.environ["MARKS"]
if dev == "receipt":
    q["lines"] = json.dumps(json.load(open(raw))[lang], ensure_ascii=False)
else:
    q["raw"] = "file://" + os.path.abspath(raw)
print("file://" + os.path.abspath(page) + "?" + u.urlencode(q))
' "${PAGE:-tools/slide/slide.html}" "$RAW" "$caption" "$DEVICE" "$W" "$H" "$LANG_")

flags=(--headless=new --hide-scrollbars --force-device-scale-factor=1 --allow-file-access-from-files
  --virtual-time-budget=5000 "--window-size=$W,$H")
# The page finishes asynchronously (font and image decode); a dump can land before it does.
for _ in 1 2 3; do
  dom=$("$CHROME" "${flags[@]}" --dump-dom "$url" 2>/dev/null)
  status=$(printf '%s' "$dom" | sed -n 's/.*data-status="\([a-z]*\)".*/\1/p' | head -1)
  [ "$status" = loading ] || break
done
# 02-scan: "marks-bottom <lowest mark y> <band top>", collected by render-html.sh for check.sh.
mb=$(printf '%s' "$dom" | sed -n 's/.*data-marks-bottom="\([0-9]*\)".*/\1/p' | head -1)
ml=$(printf '%s' "$dom" | sed -n 's/.*data-marks-limit="\([0-9]*\)".*/\1/p' | head -1)
[ -n "$mb" ] && echo "marks-bottom $mb $ml"
if [ "$status" != ok ]; then
  echo "FAIL: ${status:-no page} ($TARGET/$LANG_/$SLIDE)"
  exit 1
fi
tmp="$OUT.tmp.png"
"$CHROME" "${flags[@]}" "--screenshot=$tmp" "$url" >/dev/null 2>&1
"$FLATTEN" "$tmp" "$OUT" && rm -f "$tmp"
