# Store Screenshots "Sunshine" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild every store screenshot set (4 languages × 8 slides, plus the Play feature graphic)
in the approved "Sunshine" look, each set framed in its own device's shape, from fresh captures of
the new navigation.

**Architecture:** One HTML/CSS slide template (`store/screenshots/tools/slide/`) draws the page,
caption, device frame and capture; `tools/render-html.sh` turns every target × language × slide into
a PNG with headless Chrome and flattens it with `sips`. Captures come from `tools/capture-ios.sh`
(updated for native tabs) and a new `tools/capture-android.sh` (Redmi). `tools/check.sh` gates the output.

**Tech Stack:** HTML/CSS, Google Chrome headless (`--screenshot`, `--dump-dom`), bash, `sips`,
`python3` (stdlib only), `axe` + `xcrun simctl` (iOS), `adb` (Android), the app's dev route
`myexpensesbook://dev/store-shots`.

**Spec:** `docs/superpowers/specs/2026-11-27-store-screenshots-sunshine-design.md` (approved 2026-11-27).

## Global Constraints

- Start captures (Task 7 on) only after the native-navigation plan
  (`docs/superpowers/plans/2026-11-27-native-navigation-implementation.md`) is merged to `main`. Tasks 1–6 may run before.
- Colours: page yellow `#FFD84A`, brand green `#1F5C4C`; caption font Bricolage Grotesque 800
  (`apps/mobile/node_modules/@expo-google-fonts/bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf`).
- Layout (mockup A, `.superpowers/brainstorm/83033-1795754431/content/style.html`): caption top-left in
  green; device tipped −4°; green bottom band with the app's zigzag receipt edge.
- Slides, order and captions unchanged: 00-free, 01-private, 02-scan, 03-month, 04-readable,
  05-stats, 06-search, 07-trips; text from `store/screenshots/captions.json`.
- Languages: en, id, es, pt-BR.
- Targets and frames:

  | out folder | size | raw source | frame |
  |---|---|---|---|
  | `appstore/iphone-6.9` | 1320 × 2868 | `raw/iphone` | iPhone (Dynamic Island) |
  | `play/phone` | 1080 × 1920 | `raw/redmi` | Android phone (punch-hole) |
  | `appstore/ipad-13` | 2064 × 2752 | `raw/ipad` | iPad (even bezel) |
  | `play/tablet` | 1440 × 2560 | `raw/ipad` | plain tablet (no brand details) |
  | `appstore/duo-outer` | 1398 × 2034 | `raw/duo-outer` | Duo closed (spine) |
  | `appstore/duo-inner` | 2007 × 2853 | `raw/duo-inner` (captured sideways) | Duo open, drawn sideways, centre fold |
  | `play/feature` | 1024 × 500 | none | none |

- Every output PNG: exact size, no alpha (`tools/check.sh png`).
- Redmi capture may `pm clear` the app (owner approved, 2026-11-27). iOS captures wipe with backup
  (`E2E_ALLOW_WIPE=1`, `reset_app_data` in `apps/mobile/e2e/lib.sh`).
- One simulator booted at a time; capture order: Redmi → Duo → iPad → iPhone 18 Pro Max (owner).
- Redmi captures never scaled up more than 1.1×.
- Feature graphic copy (spec):
  en "Scan receipts and see where your money goes. Free, private, no ads." ·
  id "Pindai struk dan lihat ke mana uangmu pergi. Gratis, privat, tanpa iklan." ·
  es "Escanea tickets y mira en qué se va tu dinero. Gratis, privada, sin anuncios." ·
  pt-BR "Escaneie recibos e veja para onde vai seu dinheiro. Grátis, privado, sem anúncios."
- No new npm or Homebrew dependencies.

## Review Focus

1. **A long caption** (pt-BR/es) wraps into the device or off the page: render must fail, not ship
   (Task 1, test `caption overflow fails the render`).
2. **A missing raw capture** for one language silently gives a 7-slide set: check must fail
   (Task 5, test `check flags a set with fewer than 8 slides`).
3. **Real status bar on the Redmi** (clock, notifications, battery): captures use Android demo mode
   (Task 6, step asserting `demo` broadcast succeeded and clock reads 09:41).
4. **Dev build chrome in a capture** (LogBox error overlay, dev menu button): capture must stop
   (Tasks 6–7, test `capture stops when the Metro log shows an ERROR`).
5. **Rotated Duo capture fed to the upright template** with wrong aspect: render must fail
   (Task 1, test `raw aspect mismatch fails the render`).

---

### Task 1: Slide template and PNG probe

**Files:**
- Create: `store/screenshots/tools/slide/slide.html`, `store/screenshots/tools/slide/slide.css`
- Create: `store/screenshots/tools/pngprobe.py`
- Create: `store/screenshots/tools/render-one.sh`
- Test: `store/screenshots/tools/test-render.sh`

**Interfaces:**
- Produces: `slide.html?target=<folder>&lang=<lang>&slide=<id>&raw=<relative png>&w=<px>&h=<px>&device=<android|iphone|ipad|tablet|duo-closed|duo-open>`
  renders one slide at exactly w × h CSS px; sets `document.body.dataset.status` to `ok`,
  `overflow` (caption taller than its box) or `aspect` (raw aspect differs from the frame's screen by > 2%).
- Produces: `tools/render-one.sh <target> <lang> <slide> <device> <raw> <w> <h> <out.png>` → exit 0 and
  writes a flattened, alpha-free PNG; exit 1 with `FAIL: <status>` when status is not `ok`.
  Chrome: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=W,H --screenshot=<out> --allow-file-access-from-files file://…`;
  status read with `--dump-dom` (grep `data-status="…"`).
- Produces: `python3 tools/pngprobe.py <png> [x y]` → prints `W H alpha=<yes|no>` and, with x y, `#RRGGBB` at that pixel (stdlib `zlib` PNG decode).

- [ ] **Step 1: Write `tools/test-render.sh`** with cases (each `PASS name`/`FAIL name`, exit 1 on any FAIL):
  - `iphone slide renders at size`: render `03-month` en, device iphone, `raw/iphone/en/02-home.png`, 1320×2868 → probe prints `1320 2868 alpha=no`.
  - `page is yellow`: pixel (20, 1400) is `#FFD84A`.
  - `caption overflow fails the render`: a caption of 400 characters (`CAPTION_OVERRIDE` env read by render-one.sh and passed as `&caption=`) → exit 1, output contains `FAIL: overflow`.
  - `raw aspect mismatch fails the render`: device duo-open with `raw/iphone/en/02-home.png` → `FAIL: aspect`.
- [ ] **Step 2: Run** `store/screenshots/tools/test-render.sh`; expected FAIL (files missing).
- [ ] **Step 3: Implement** `slide.html/.css` (mockup A: yellow page, green caption top-left, −4° device, green band with zigzag edge), `pngprobe.py`, `render-one.sh`. Frames for all six devices come in Task 2; here only `iphone`.
- [ ] **Step 4: Run**; expected all PASS.
- [ ] **Step 5: Commit** — `feat(store): Sunshine slide template rendered with headless Chrome`.

### Task 2: Device frames

**Files:**
- Modify: `store/screenshots/tools/slide/slide.css` (one block per device)
- Create: `store/screenshots/tools/slide/frames-preview.html` (all six frames on one yellow page)
- Test: `store/screenshots/tools/test-render.sh` (new cases)

**Interfaces:**
- Consumes: `render-one.sh` (Task 1).
- Frame screen aspects (width/height of the screen opening), used by the `aspect` check:
  android 720/1640, iphone 1320/2868, ipad 2064/2752, tablet 2064/2752, duo-closed 1398/2034,
  duo-open 2853/2007 (sideways).

- [ ] **Step 1: Add test cases**: for each device, render `03-month` en with its raw (`raw/ipad/...` for tablet; for android and duo-open use any existing raw of matching aspect, or a solid test PNG `tools/slide/test-<device>.png` generated by `sips`) at its target size → `alpha=no`, exact size, status ok.
- [ ] **Step 2: Run**; expected FAIL for the five new devices.
- [ ] **Step 3: Implement** the frames: android (slim bezel, ~8% corner radius, punch-hole dot), iphone (Dynamic Island), ipad (even thick bezel), tablet (same as ipad, no camera dot), duo-closed (phone with a spine on the hinge side), duo-open (wide, drawn sideways, centre fold line), proportions as in the mockup.
- [ ] **Step 4: Run**; expected PASS. Render `frames-preview.html` to `out/test/frames-preview.png` and look at it.
- [ ] **Step 5: Commit** — `feat(store): device frames for every store set`.

### Task 3: Receipt slides (00-free, 01-private)

**Files:**
- Modify: `store/screenshots/tools/slide/slide.html` (`device=receipt` draws a paper receipt card from a JSON slip)
- Test: `store/screenshots/tools/test-render.sh`

**Interfaces:**
- Consumes: `zero-receipt.json`, `private-receipt.json` (`{lang: ["LABEL\tVALUE", …]}`; `TOTAL…` line highlighted yellow).
- Produces: `slide.html?...&device=receipt&slip=<zero-receipt|private-receipt>`.

- [ ] **Step 1: Add cases**: `00-free` and `01-private`, en and pt-BR, on 1320×2868 and 2007×2853 → size, alpha=no, status ok.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement** the receipt card (white paper, mono lines, zigzag top and bottom edges, TOTAL line on yellow highlight, tipped −4° like the device).
- [ ] **Step 4: Run**; expected PASS.
- [ ] **Step 5: Commit** — `feat(store): receipt slides in the Sunshine look`.

### Task 4: Play feature graphic

**Files:**
- Create: `store/screenshots/tools/slide/feature.html`
- Modify: `store/screenshots/captions.json` (`feature` → the four strings in Global Constraints)
- Test: `store/screenshots/tools/test-render.sh`

**Interfaces:**
- Produces: `feature.html?lang=<lang>` at 1024×500: yellow page, app icon (`apps/mobile/assets/images/icon.png`), app name "My Expenses Book" in green, the `feature` caption, the tilted zero-receipt card on the right, green zigzag band along the bottom. Same `data-status` contract.

- [ ] **Step 1: Add cases**: each language → 1024×500, alpha=no, status ok; pixel (12, 12) `#FFD84A`.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement** `feature.html` and the caption change.
- [ ] **Step 4: Run**; expected PASS.
- [ ] **Step 5: Commit** — `feat(store): feature graphic in the Sunshine look with new copy`.

### Task 5: Render all sets and check them

**Files:**
- Create: `store/screenshots/tools/render-html.sh`
- Modify: `store/screenshots/tools/check.sh` (DEVICES adds `redmi`; `play/phone` source `raw/redmi`; marks keys for `redmi`)
- Modify: `store/screenshots/tools/render.sh` (header comment: superseded by `render-html.sh`; kept for history)

**Interfaces:**
- Consumes: `render-one.sh` (Tasks 1–3), `feature.html` (Task 4), `marks.json` for 02-scan (`[[x,y,w,h],[x,y,w,h]]` in raw px; passed to the template as `&marks=`).
- Produces: `tools/render-html.sh [lang ...]` writes every target in the Global Constraints table to `out/<folder>/<lang>/<slide>.png` and `out/play/feature/<lang>.png`; a raw missing → `warning: … skipped` and exit 1 at the end.

- [ ] **Step 1: Add check case** `check flags a set with fewer than 8 slides`: a temp `out/` copy with one slide deleted → `tools/check.sh files` prints `FAIL` (run against a temp copy so `out/` stays intact).
- [ ] **Step 2: Run**; expected FAIL if `files()` does not yet cover `play/phone` from `raw/redmi`; fix `check.sh`.
- [ ] **Step 3: Implement `render-html.sh`** (slide map as in `render.sh` SLIDES; 02-scan passes marks).
- [ ] **Step 4: Run** `tools/render-html.sh en` on the existing raws (Redmi and sideways Duo raws do not exist yet: expect warnings for `play/phone` and `duo-inner`); look at `out/appstore/iphone-6.9/en/*.png`.
- [ ] **Step 5: Commit** — `feat(store): render every store set from the Sunshine template`.

### Task 6: Redmi capture script

**Files:**
- Create: `store/screenshots/tools/capture-android.sh`
- Create: `store/screenshots/tools/redmi.env` (tap positions in device px for the 720 × 1640 portrait screen)

**Interfaces:**
- Produces: `capture-android.sh <serial> <lang> <outdir> <metro-log>` → `outdir/{01-review,02-home,03-zoom,04-stats,05-trip,06-search}.png` (same names as `capture-ios.sh`).
  Steps: `adb reverse tcp:8081 tcp:8081` and `tcp:8099`; `adb shell pm clear com.terhubung.myexpensesbook`
  once per language; system locale for the language; demo mode on
  (`settings put global sysui_demo_allowed 1`, broadcasts `com.android.systemui.demo` clock `hhmm 0941`,
  notifications `visible false`, battery `level 100 plugged false`), off at exit (trap);
  open the dev client, then `myexpensesbook://dev/store-shots?lang=…&today=2026-11-24&w=…&h=…&then=…&photo=http%3A%2F%2F127.0.0.1%3A8099%2F<lang>.jpg`;
  wait for `STORE_SHOTS_DONE` in the Metro log; `adb exec-out screencap -p`.

- [ ] **Step 1: Write the guard test** in the script's `--self-test` mode: `capture stops when the Metro log shows an ERROR` — feed a temp log containing ` ERROR ` after the start mark → exits 1 with `FAIL: Metro error during capture`.
- [ ] **Step 2: Run** `tools/capture-android.sh --self-test`; expected FAIL (script missing).
- [ ] **Step 3: Implement** the script (same guard in `capture-ios.sh` in Task 7).
- [ ] **Step 4: Run** `--self-test`; expected PASS. Then one live screen: `SHOTS=02-home tools/capture-android.sh <serial> en /tmp/redmi-try <log>`; expected a 720 × 1640 PNG whose status-bar clock reads 09:41.
- [ ] **Step 5: Commit** — `feat(store): Redmi capture script`.

### Task 7: iOS capture for native navigation

**Files:**
- Modify: `store/screenshots/tools/capture-ios.sh` (tabs tapped by their localized label via `axe tap --label`; Metro ERROR guard; `ROTATE=landscape` rotates before capture)
- Modify: `store/screenshots/tools/duo-inner.env`, `duo-outer.env`, `ipad.env` (tap positions for the native layouts)

**Interfaces:**
- Consumes: tab labels from `apps/mobile/src/i18n/locales/<lang>.json` keys `tabs.receipts`, `tabs.search`, `tabs.folders`, `tabs.settings`.
- Produces: same six raw names; Duo inner captured with `ROTATE=landscape` → 2853 × 2007 PNGs.

- [ ] **Step 1: Add** `--self-test` to `capture-ios.sh` with the Metro ERROR case (as Task 6) and a `tab label lookup` case (`es` Search → "Buscar").
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `--self-test`; expected PASS.
- [ ] **Step 5: Commit** — `feat(store): iOS capture for native tabs and the sideways Duo`.

### Task 8: Capture everything (owner's order)

Precondition: native navigation merged to `main`; Metro running on `main`; photos served
(`python3 -m http.server 8099` in `store/screenshots/out/photos`).

- [ ] **Step 1: Redmi** — for each language: `tools/capture-android.sh <serial> <lang> raw/redmi/<lang> <log>`; look at each set.
- [ ] **Step 2: Duo** (`06C208F7-96E7-4012-A374-F81F9722F168`) — closed: `source tools/duo-outer.env; tools/capture-ios.sh … raw/duo-outer/<lang>`; open, sideways: `source tools/duo-inner.env; ROTATE=landscape tools/capture-ios.sh … raw/duo-inner/<lang>`; then `xcrun simctl shutdown`.
- [ ] **Step 3: iPad** (`B24A182C-2A5E-4CE6-ABE8-E2CD724B9E24`) — `source tools/ipad.env; … raw/ipad/<lang>`; then shutdown.
- [ ] **Step 4: iPhone 18 Pro Max** (`8EF8721F-AE01-4266-9BBE-3CBDBD74F70F`) — `… raw/iphone/<lang>`; then shutdown.
- [ ] **Step 5: Marks** — `swift tools/find-marks.swift raw/*/*/01-review.png > marks.json`; expected one entry per device/lang (field mark only allowed where the TOTAL is off screen, listed in `check.sh` `NO_RECEIPT_TOTAL`).
- [ ] **Step 6: Commit** `marks.json` (raws are git-ignored) — `chore(store): marks for the new captures`.

### Task 9: Render, check, owner review

- [ ] **Step 1: Render** — `tools/render-html.sh`; expected no warnings.
- [ ] **Step 2: Check** — `tools/check.sh`; expected no `FAIL`.
- [ ] **Step 3: Owner review** — publish a contact sheet (one row per set, en) for the owner; fix what they flag.
- [ ] **Step 4: Docs** — `docs/store/submit-screenshots-and-languages.md`: Play phone now from the Redmi; Duo inner shows the sideways Duo in an upright image; feature copy. Update memory `store-screenshots-status`.
- [ ] **Step 5: Commit and push to `main`** — `docs(store): Sunshine screenshots ready to upload`.
