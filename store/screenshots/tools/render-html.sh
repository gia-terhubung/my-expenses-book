#!/usr/bin/env bash
# Builds every store screenshot in the "Sunshine" look from the raw captures in
# raw/<device>/<lang>/NN-name.png (spec docs/superpowers/specs/2026-11-27-store-screenshots-sunshine-design.md):
#   raw/iphone     -> out/appstore/iphone-6.9 (1320x2868), iPhone frame
#   raw/redmi      -> out/play/phone (1080x1920), Android phone frame
#   raw/ipad       -> out/appstore/ipad-13 (2064x2752), iPad frame; out/play/tablet (1440x2560), plain tablet
#   raw/duo-outer  -> out/appstore/duo-outer (1398x2034), Duo closed
#   raw/duo-inner  -> out/appstore/duo-inner (2007x2853), Duo open drawn sideways (captured sideways)
# Slides 00-free and 01-private are receipts drawn from zero-receipt.json and private-receipt.json;
# out/play/feature/<lang>.png is the Play feature graphic. Each slide goes through tools/render-one.sh.
# Usage: tools/render-html.sh [lang ...]. Exits 1 if any slide was skipped or failed.
set -u
cd "$(dirname "$0")/.."
LANGS=${*:-"en id es pt-BR"}
problems=0

# Raw capture name -> store slide name (as in render.sh).
SLIDES="01-review 02-scan
02-home 03-month
03-zoom 04-readable
04-stats 05-stats
06-search 06-search
05-trip 07-trips"

# raw-folder  target-folder  W  H  frame
TARGETS="iphone appstore/iphone-6.9 1320 2868 iphone
redmi play/phone 1080 1920 android
ipad appstore/ipad-13 2064 2752 ipad
ipad play/tablet 1440 2560 tablet
duo-outer appstore/duo-outer 1398 2034 duo-closed
duo-inner appstore/duo-inner 2007 2853 duo-open"

marks() { python3 -c 'import json,sys; r=json.load(open("marks.json")).get(sys.argv[1]); print(";".join("-" if x is None else ",".join(map(str,x)) for x in r) if r else "")' "$1"; }

: > out/.marks-placement.new
while read -r dev target w h frame; do
  for lang in $LANGS; do
    dir="out/$target/$lang"
    mkdir -p "$dir"
    rm -f "$dir"/*.png
    tools/render-one.sh "$target" "$lang" 00-free receipt zero-receipt.json "$w" "$h" "$dir/00-free.png" || problems=$((problems + 1))
    tools/render-one.sh "$target" "$lang" 01-private receipt private-receipt.json "$w" "$h" "$dir/01-private.png" || problems=$((problems + 1))
    while read -r rawname slide; do
      raw="raw/$dev/$lang/$rawname.png"
      if [ ! -f "$raw" ]; then
        echo "warning: $raw missing, $target/$lang/$slide skipped" >&2
        problems=$((problems + 1))
        continue
      fi
      m=""; [ "$slide" = 02-scan ] && m=$(marks "$dev/$lang")
      if ! out=$(MARKS="$m" tools/render-one.sh "$target" "$lang" "$slide" "$frame" "$raw" "$w" "$h" "$dir/$slide.png"); then
        echo "$out" >&2
        problems=$((problems + 1))
        continue
      fi
      printf '%s\n' "$out" | sed -n "s|^marks-bottom |$target/$lang |p" >> out/.marks-placement.new
    done <<< "$SLIDES"
    echo "$target/$lang: $(ls "$dir" | wc -l | tr -d ' ') slides"
  done
done <<< "$TARGETS"
mv out/.marks-placement.new out/.marks-placement

mkdir -p out/play/feature
for lang in $LANGS; do
  PAGE=tools/slide/feature.html tools/render-one.sh play/feature "$lang" feature receipt zero-receipt.json 1024 500 "out/play/feature/$lang.png" ||
    problems=$((problems + 1))
done

[ "$problems" -eq 0 ] || { echo "$problems slide(s) skipped or failed" >&2; exit 1; }
