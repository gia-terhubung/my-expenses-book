#!/usr/bin/env bash
# Checks the store screenshot data and output. Run from anywhere; works in store/screenshots/.
# Usage: tools/check.sh [slips|files|marks|png ...]   (no argument: all sections)
# Prints "FAIL: <reason>" for each problem and exits 1 if there was any.
set -u
cd "$(dirname "$0")/.."
SECTIONS=${*:-"slips files marks png"}
exec python3 - $SECTIONS <<'PY'
import json, os, subprocess, sys

LANGS = ["en", "id", "es", "pt-BR"]
DEVICES = ["iphone", "ipad", "duo-outer", "duo-inner"]
SLIDES = ["00-free", "01-private", "02-scan", "03-month", "04-readable", "05-stats", "06-search", "07-trips"]
# Folder under out/ and its size, as in render.sh TARGETS.
TARGETS = {
    "appstore/iphone-6.9": (1320, 2868), "play/phone": (1080, 1920),
    "appstore/ipad-13": (2064, 2752), "play/tablet": (1440, 2560),
    "appstore/duo-outer": (1398, 2034), "appstore/duo-inner": (2007, 2853),
}
# Characters that fit on one slip line (promo.swift: 76-unit slip, 8-unit padding, mono 4.3 / bold 4.9).
LINE_MAX, TOTAL_MAX = 21, 19
fails = []

def load(path):
    if not os.path.exists(path):
        fails.append(f"{path} missing")
        return None
    return json.load(open(path))

def slips():
    for path in ["zero-receipt.json", "private-receipt.json"]:
        data = load(path)
        if data is None:
            continue
        for lang in LANGS:
            if lang not in data:
                fails.append(f"{path}: no {lang}")
                continue
            for line in data[lang]:
                parts = line.split("\t")
                n = len(parts[0]) + len(parts[1]) + 1 if len(parts) == 2 else len(line)
                limit = TOTAL_MAX if parts[0].startswith("TOTAL") else LINE_MAX
                if n > limit:
                    fails.append(f"{path} {lang}: '{line}' is {n} chars, max {limit}")

def captions():
    data = load("captions.json")
    if data is None:
        return
    for key in SLIDES + ["feature"]:
        for lang in LANGS:
            if not data.get(key, {}).get(lang):
                fails.append(f"captions.json: no {key}/{lang}")

def files():
    captions()
    for target in TARGETS:
        for lang in LANGS:
            folder = f"out/{target}/{lang}"
            have = sorted(f[:-4] for f in os.listdir(folder) if f.endswith(".png")) if os.path.isdir(folder) else []
            if have != SLIDES:
                extra = sorted(set(have) - set(SLIDES))
                missing = sorted(set(SLIDES) - set(have))
                fails.append(f"{folder}: unexpected {extra}, missing {missing}")

def size(path):
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", "-g", "hasAlpha", path],
                         capture_output=True, text=True).stdout
    vals = dict(l.strip().split(": ", 1) for l in out.splitlines()[1:] if ": " in l)
    return int(vals.get("pixelWidth", 0)), int(vals.get("pixelHeight", 0)), vals.get("hasAlpha")

def marks():
    data = load("marks.json")
    if data is None:
        return
    for dev in DEVICES:
        for lang in LANGS:
            key = f"{dev}/{lang}"
            rects = data.get(key)
            if not rects or len(rects) != 2 or any(len(r) != 4 for r in rects):
                fails.append(f"marks.json: {key} needs 2 rects [x, y, w, h]")
                continue
            raw = f"raw/{dev}/{lang}/01-review.png"
            w, h, _ = size(raw)
            for x, y, rw, rh in rects:
                if x < 0 or y < 0 or rw <= 0 or rh <= 0 or x + rw > w or y + rh > h:
                    fails.append(f"marks.json: {key} rect {[x, y, rw, rh]} outside {w}x{h}")
            if rects[1][1] <= rects[0][1] + rects[0][3]:
                fails.append(f"marks.json: {key} field rect is not below the receipt rect")

def png():
    for target, (W, H) in TARGETS.items():
        for lang in LANGS:
            for slide in SLIDES:
                path = f"out/{target}/{lang}/{slide}.png"
                if not os.path.exists(path):
                    continue  # reported by files
                w, h, alpha = size(path)
                if (w, h) != (W, H) or alpha != "no":
                    fails.append(f"{path}: {w}x{h} alpha={alpha}, want {W}x{H} alpha=no")
    for lang in LANGS:
        path = f"out/play/feature/{lang}.png"
        w, h, alpha = size(path) if os.path.exists(path) else (0, 0, None)
        if (w, h) != (1024, 500) or alpha != "no":
            fails.append(f"{path}: {w}x{h} alpha={alpha}, want 1024x500 alpha=no")

for section in sys.argv[1:]:
    {"slips": slips, "files": files, "marks": marks, "png": png}[section]()
for f in fails:
    print("FAIL:", f)
print("ok" if not fails else f"{len(fails)} problem(s)")
sys.exit(1 if fails else 0)
PY
