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
DEVICES = ["iphone", "redmi", "ipad", "duo-outer", "duo-inner"]
SLIDES = ["00-free", "01-private", "02-scan", "03-month", "04-readable", "05-stats", "06-search", "07-trips"]
# Folder under out/ and its size, as in render.sh TARGETS.
TARGETS = {
    "appstore/iphone-6.9": (1320, 2868), "play/phone": (1080, 1920),
    "appstore/ipad-13": (2064, 2752), "play/tablet": (1440, 2560),
    "appstore/duo-outer": (1398, 2034), "appstore/duo-inner": (2007, 2853),
}
# Characters that fit on one slip line (promo.swift: 76-unit slip, 8-unit padding, mono 4.3 / bold 4.9).
LINE_MAX, TOTAL_MAX = 21, 19
# Raw review captures whose receipt photo is scrolled so TOTAL is off screen: field mark only.
NO_RECEIPT_TOTAL = {"duo-inner/en"}
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
    placement()
    data = load("marks.json")
    if data is None:
        return
    for dev in DEVICES:
        for lang in LANGS:
            key = f"{dev}/{lang}"
            rects = data.get(key)
            # The receipt rect may be null only where the raw does not show the receipt's TOTAL.
            receipt_ok = rects and (rects[0] is not None or key in NO_RECEIPT_TOTAL)
            if not rects or len(rects) != 2 or not receipt_ok or any(r is not None and len(r) != 4 for r in rects) or rects[1] is None:
                fails.append(f"marks.json: {key} needs 2 rects [x, y, w, h]")
                continue
            raw = f"raw/{dev}/{lang}/01-review.png"
            w, h, _ = size(raw)
            for r in rects:
                if r is None:
                    continue
                x, y, rw, rh = r
                if x < 0 or y < 0 or rw <= 0 or rh <= 0 or x + rw > w or y + rh > h:
                    fails.append(f"marks.json: {key} rect {r} outside {w}x{h}")
            receipt, field = rects
            # The field is in the form, which starts left of (phones) or right of (iPad) the receipt row.
            if receipt is not None and receipt[0] <= field[0] <= receipt[0] + receipt[2]:
                fails.append(f"marks.json: {key} field rect starts inside the receipt row")

def placement():
    # Written by render-html.sh: every scan-slide mark must end above the green band.
    path = "out/.marks-placement"
    if not os.path.exists(path):
        fails.append(f"{path} missing: run tools/render-html.sh")
        return
    seen = set()
    for line in open(path):
        where, bottom, limit = line.split()
        seen.add(where)
        if int(bottom) > int(limit):
            fails.append(f"out/{where}/02-scan.png: mark ends at y={bottom}, below the page margin {limit}")
    for target in TARGETS:
        for lang in LANGS:
            if f"{target}/{lang}" not in seen:
                fails.append(f"out/{target}/{lang}/02-scan.png: no marks drawn")

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

SECTIONS = {"slips": slips, "files": files, "marks": marks, "png": png}
for section in sys.argv[1:]:
    if section not in SECTIONS:
        fails.append(f"unknown section {section}; use {' '.join(SECTIONS)}")
        continue
    SECTIONS[section]()
for f in fails:
    print("FAIL:", f)
print("ok" if not fails else f"{len(fails)} problem(s)")
sys.exit(1 if fails else 0)
PY
