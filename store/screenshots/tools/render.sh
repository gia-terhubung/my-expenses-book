#!/usr/bin/env bash
# Builds every store screenshot from the raw captures in raw/<device>/<lang>/NN-name.png.
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

caption() { python3 -c 'import json,sys; print(json.load(open("captions.json"))[sys.argv[1]][sys.argv[2]])' "$1" "$2"; }

# device  crop-top-px  target-folder  W  H
TARGETS="iphone 186 appstore/iphone-6.9 1320 2868
iphone 186 play/phone 1080 1920
ipad 64 appstore/ipad-13 2064 2752
ipad 64 play/tablet 1440 2560
duo-outer 0 appstore/duo-outer 1398 2034
duo-inner 246 appstore/duo-inner 2007 2853"

echo "$TARGETS" | while read -r dev crop target w h; do
  for lang in $LANGS; do
    src="raw/$dev/$lang"
    [ -d "$src" ] || continue
    mkdir -p "out/$target/$lang"
    for f in "$src"/*.png; do
      name=$(basename "$f" .png)
      "$BIN" "$FONT" "$f" "$crop" "$w" "$h" "$(caption "$name" "$lang")" "out/$target/$lang/$name.png"
    done
    "$PROMO" "$FONT" zero-receipt.json "$lang" "$w" "$h" "$(caption 00-free "$lang")" "out/$target/$lang/00-free.png"
    "$PROMO" "$FONT" private-receipt.json "$lang" "$w" "$h" "$(caption 01-private "$lang")" "out/$target/$lang/01-private.png"
    echo "$target/$lang: $(ls "out/$target/$lang" | wc -l | tr -d ' ') shots"
  done
done
