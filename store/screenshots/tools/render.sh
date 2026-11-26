#!/usr/bin/env bash
# Builds every store screenshot from the raw captures in raw/<device>/<lang>/NN-name.png,
# renamed to the store slide order by SLIDES below.
#   raw/iphone      -> out/appstore/iphone-6.9 (1320x2868) and out/play/phone (1080x1920)
#   raw/ipad        -> out/appstore/ipad-13 (2064x2752) and out/play/tablet (1440x2560, 7" and 10")
#   raw/duo-outer   -> out/appstore/duo-outer (1398x2034)
#   raw/duo-inner   -> out/appstore/duo-inner (2007x2853)
# Slides 00-free (the "zero receipt") and 01-private (the privacy receipt) have no raw capture:
# tools/promo.swift draws them from zero-receipt.json and private-receipt.json for every target
# that has that language.
# A device folder that does not exist yet is skipped. Usage: tools/render.sh [lang ...]
set -u
cd "$(dirname "$0")/.."
FONT="../../apps/mobile/node_modules/@expo-google-fonts/bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf"
LANGS=${*:-"en id es pt-BR"}
BIN=out/.frame
mkdir -p out
# Compile once: running the script through `swift` per image is slow.
[ "$BIN" -nt tools/frame.swift ] || swiftc -O tools/frame.swift -o "$BIN"
PROMO=out/.promo
[ "$PROMO" -nt tools/promo.swift ] || swiftc -O tools/promo.swift -o "$PROMO"

# Marks for the scan slide, from marks.json: "x,y,w,h;x,y,w,h" ("-" for a missing rect).
marks() { python3 -c 'import json,sys; r=json.load(open("marks.json")).get(sys.argv[1]); print(";".join("-" if x is None else ",".join(map(str,x)) for x in r) if r else "")' "$1"; }
caption() { python3 -c 'import json,sys; print(json.load(open("captions.json"))[sys.argv[1]][sys.argv[2]])' "$1" "$2"; }

# Raw capture name -> store slide name. The raws keep the names capture-ios.sh and the website use;
# the slides carry the store order (00-free and 01-private are drawn by promo.swift below).
SLIDES="01-review 02-scan
02-home 03-month
03-zoom 04-readable
04-stats 05-stats
06-search 06-search
05-trip 07-trips"

# device  crop-top-px  target-folder  W  H
TARGETS="iphone 186 appstore/iphone-6.9 1320 2868
iphone 186 play/phone 1080 1920
ipad 64 appstore/ipad-13 2064 2752
ipad 64 play/tablet 1440 2560
duo-outer 0 appstore/duo-outer 1398 2034
duo-inner 246 appstore/duo-inner 2007 2853"

# One line per marked slide, "<target>/<lang> <mark bottom> <usable bottom>", read by check.sh.
rm -f out/.marks-placement
echo "$TARGETS" | while read -r dev crop target w h; do
  for lang in $LANGS; do
    src="raw/$dev/$lang"
    [ -d "$src" ] || continue
    mkdir -p "out/$target/$lang"
    rm -f "out/$target/$lang"/*.png
    echo "$SLIDES" | while read -r rawname slide; do
      f="$src/$rawname.png"
      [ -f "$f" ] || { echo "warning: $f missing, $slide skipped" >&2; continue; }
      extra=""; [ "$slide" = 02-scan ] && extra=$(marks "$dev/$lang")
      "$BIN" "$FONT" "$f" "$crop" "$w" "$h" "$(caption "$slide" "$lang")" "out/$target/$lang/$slide.png" ${extra:+"$extra"} |
        sed -n "s|^marks-bottom |$target/$lang |p" >> out/.marks-placement
    done
    "$PROMO" "$FONT" zero-receipt.json "$lang" "$w" "$h" "$(caption 00-free "$lang")" "out/$target/$lang/00-free.png"
    "$PROMO" "$FONT" private-receipt.json "$lang" "$w" "$h" "$(caption 01-private "$lang")" "out/$target/$lang/01-private.png"
    echo "$target/$lang: $(ls "out/$target/$lang" | wc -l | tr -d ' ') shots"
  done
done
