# Store Story: Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the store screenshot set as 8 slides (Free, Private, Scan, Month, Readable, Stats, Search, Trips) with a new privacy slide, a marked scan slide, plain captions and a new feature-graphic tagline, in 4 languages, from the existing raw captures.

**Architecture:** All text stays in data files next to the tools (`captions.json`, `zero-receipt.json`, new `private-receipt.json`, new `marks.json`). `render.sh` maps raw capture names to new output names, so the raws, `capture-ios.sh` and the website's `prepare-screenshots.mjs` keep working unchanged. `promo.swift` already draws any slip from a JSON file; it is called twice. `frame.swift` gets an optional marks argument. A new `tools/find-marks.swift` uses Apple Vision text recognition to measure the marks once. A new `tools/check.sh` is the test.

**Tech Stack:** Swift scripts (AppKit, Vision) compiled with `swiftc`, bash, python3 (stdlib only).

**Spec:** `docs/superpowers/specs/2026-11-26-store-story-privacy-design.md`

## Global Constraints

- No new app captures. Raw files in `store/screenshots/raw/<device>/<lang>/` keep their names (`01-review` … `06-search`).
- Languages: `en`, `id`, `es`, `pt-BR`. Devices: `iphone`, `ipad`, `duo-outer`, `duo-inner`.
- Output: 8 files per folder, in this order: `00-free`, `01-private`, `02-scan`, `03-month`, `04-readable`, `05-stats`, `06-search`, `07-trips`.
- Every line on the privacy slip must be true on iOS and Android. "App lock" stays platform-neutral (no "Face ID").
- PNGs stay opaque (stores reject alpha) and keep the sizes in `render.sh` `TARGETS`.
- The website (`apps/web`) is not changed.
- Run everything from `store/screenshots/`. `out/` and `raw/` are git-ignored; commit only tools, JSON and docs.

## Review Focus

1. Long ES/PT-BR slip lines overflowing into each other on the receipt. Pinned by `check.sh` char budgets (Task 1).
2. Stale files from the old 7-slide names (`01-review.png` …) left in `out/` and uploaded by mistake. Pinned by `check.sh` exact file list (Task 2).
3. Vision missing the receipt TOTAL (ID uses `TOTAL` above `TUNAI`; PT-BR may print `VALOR TOTAL`) or matching the wrong row (`SUBTOTAL`). Pinned by `check.sh` requiring 2 marks per raw and by the find rule (Task 3).
4. Marks drawn in the wrong place on the 246 px / 64 px / 0 px top-cropped devices. Pinned by the visual check on one shot per device (Task 3).
5. The ES caption wrapping to 3 lines and pushing the screen down. Pinned by the visual check of `02-scan` ES (Task 2).

---

### Task 1: Privacy slide

**Files:**
- Create: `store/screenshots/private-receipt.json`
- Create: `store/screenshots/tools/check.sh`
- Modify: `store/screenshots/tools/render.sh` (call `promo.swift` a second time)
- Modify: `store/screenshots/captions.json` (add key `01-private`)

**Interfaces:**
- Produces: `tools/check.sh [section ...]`, exit 0 on pass, prints `FAIL: <reason>` lines and exits 1 otherwise. Sections: `slips`, `files`, `marks`, `png`; no argument runs all. Later tasks add sections to it.
- Produces: `out/<target>/<lang>/01-private.png` for all 6 targets.

- [ ] **Step 1: Write `tools/check.sh` with section `slips`**

python3 inline. For `zero-receipt.json` and `private-receipt.json`, every language in `en id es pt-BR` exists, and for each `name<TAB>value` line: `len(name)+len(value)+1 <= 21`, or `<= 19` when name starts with `TOTAL`. Plain lines `<= 21`. Also every caption key in the slide list of Global Constraints exists in `captions.json` for all 4 languages (this part fails until Task 2; run only `slips` now).

- [ ] **Step 2: Run it to make sure it fails**

Run: `tools/check.sh slips`
Expected: `FAIL: private-receipt.json missing`

- [ ] **Step 3: Create `private-receipt.json`** (exact copy; tab between name and value)

```json
{
  "en": ["YOUR RECEIPTS", "", "Stored on\tthis phone", "Cloud upload\t0", "Data sent to us\t0", "Encrypted\tyes", "App lock\tyes", "Backup\tyour own file", "", "TOTAL\tON YOUR PHONE"],
  "id": ["STRUKMU", "", "Tempat\tponsel ini", "Unggah ke cloud\t0", "Data ke kami\t0", "Terenkripsi\tya", "Kunci aplikasi\tya", "Cadangan\tfile milikmu", "", "TOTAL\tDI PONSELMU"],
  "es": ["TUS TICKETS", "", "Dónde\teste móvil", "Subida a la nube\t0", "Datos que recibimos\t0", "Cifrado\tsí", "Bloqueo de la app\tsí", "Copia\ttu archivo", "", "TOTAL\tEN TU MÓVIL"],
  "pt-BR": ["SEUS CUPONS", "", "Fica em\teste celular", "Envio à nuvem\t0", "Dados que recebemos\t0", "Criptografado\tsim", "Bloqueio do app\tsim", "Backup\tarquivo seu", "", "TOTAL\tNO CELULAR"]
}
```

Add to `captions.json`: `"01-private": { "en": "Your receipts stay on your phone.", "id": "Strukmu tetap di ponselmu.", "es": "Tus tickets se quedan en tu móvil.", "pt-BR": "Seus cupons ficam no seu celular." }`

- [ ] **Step 4: In `render.sh`, after the `00-free` promo call, add the same call with `private-receipt.json`, caption `01-private`, output `01-private.png`.** Update the header comment to name both promo slides.

- [ ] **Step 5: Run the check and render**

Run: `tools/check.sh slips && tools/render.sh en`
Expected: check passes; each `en` folder lists one more shot.

- [ ] **Step 6: Visual check.** Open `out/appstore/iphone-6.9/en/01-private.png` and `out/play/tablet/es/01-private.png` (render `es` too): no line overlaps, TOTAL highlighted, same look as `00-free`.

- [ ] **Step 7: Commit**

```bash
git add store/screenshots/private-receipt.json store/screenshots/captions.json store/screenshots/tools/render.sh store/screenshots/tools/check.sh
git commit -m "feat(store): privacy receipt slide"
```

### Task 2: New order, names and captions

**Files:**
- Modify: `store/screenshots/tools/render.sh`
- Modify: `store/screenshots/captions.json`
- Modify: `store/screenshots/tools/check.sh` (section `files`)

**Interfaces:**
- Consumes: `check.sh` from Task 1.
- Produces: in `render.sh`, a raw-to-slide map used by Task 3:

```
01-review 02-scan
02-home   03-month
03-zoom   04-readable
04-stats  05-stats
06-search 06-search
05-trip   07-trips
```

- [ ] **Step 1: Add section `files` to `check.sh`.** For each of the 24 output folders (6 targets × 4 langs): the PNG names are exactly the 8 from Global Constraints, nothing more.

- [ ] **Step 2: Run it to make sure it fails**

Run: `tools/check.sh files`
Expected: `FAIL` lines naming `01-review.png` as unexpected.

- [ ] **Step 3: Change `render.sh`.** Before rendering a folder, delete its `*.png` (removes the old names). Loop over the map above instead of `"$src"/*.png`: read `raw/$dev/$lang/<raw>.png`, look up the caption by `<slide>`, write `<slide>.png`. Skip a missing raw with a warning, as missing folders are skipped today.

- [ ] **Step 4: Rewrite `captions.json`.** Remove the keys `01-review`, `02-home`, `03-zoom`, `04-stats`, `05-trip`. Keep `00-free`, `06-search` and the new `01-private` as they are. Add:

```json
"02-scan": { "en": "Scan a receipt. The total fills in.", "id": "Pindai struk. Totalnya terisi sendiri.", "es": "Escanea un ticket. El total se rellena solo.", "pt-BR": "Escaneie o cupom. O total se preenche sozinho." },
"03-month": { "en": "Your monthly spending at a glance.", "id": "Pengeluaran bulananmu, sekali lihat.", "es": "Tus gastos del mes, de un vistazo.", "pt-BR": "Seus gastos do mês num relance." },
"04-readable": { "en": "Every receipt photo, sharp and readable.", "id": "Setiap foto struk, tajam dan jelas.", "es": "Cada foto de ticket, nítida y legible.", "pt-BR": "Cada foto de cupom, nítida e legível." },
"05-stats": { "en": "See where your money goes.", "id": "Lihat ke mana uangmu pergi.", "es": "Mira en qué se va tu dinero.", "pt-BR": "Veja para onde vai o seu dinheiro." },
"07-trips": { "en": "Travel and projects, in any currency.", "id": "Perjalanan dan proyek, mata uang apa pun.", "es": "Viajes y proyectos, en cualquier moneda.", "pt-BR": "Viagens e projetos, em qualquer moeda." },
"feature": { "en": "Free. Private. No ads.", "id": "Gratis. Privat. Tanpa iklan.", "es": "Gratis. Privada. Sin anuncios.", "pt-BR": "Grátis. Privado. Sem anúncios." }
```

- [ ] **Step 5: Render and check**

Run: `tools/render.sh && tools/check.sh slips files`
Expected: every folder reports `8 shots`; check passes.

- [ ] **Step 6: Visual check.** `out/appstore/iphone-6.9/es/02-scan.png` and `out/appstore/duo-outer/es/04-readable.png`: caption fits in 2 lines (3 is acceptable only if the screen still shows the receipt).

- [ ] **Step 7: Commit**

```bash
git add store/screenshots/tools/render.sh store/screenshots/tools/check.sh store/screenshots/captions.json
git commit -m "feat(store): 8-slide order and plain captions"
```

### Task 3: Total marker on the scan slide

**Files:**
- Create: `store/screenshots/tools/find-marks.swift`
- Create: `store/screenshots/marks.json`
- Modify: `store/screenshots/tools/frame.swift` (optional 8th argument)
- Modify: `store/screenshots/tools/render.sh` (pass marks for `02-scan`)
- Modify: `store/screenshots/tools/check.sh` (section `marks`)

**Interfaces:**
- Produces: `swift tools/find-marks.swift raw/*/*/01-review.png > marks.json`. Output is a JSON object keyed `<device>/<lang>` (e.g. `"iphone/en"`), value `[[x, y, w, h], [x, y, w, h]]` in raw pixels, top-left origin: first the receipt TOTAL row, then the Total field. Exit 1, naming the file on stderr, when either is not found.
- Produces: `frame.swift <font> <raw> <crop> <W> <H> <caption> <out> [marks]`, where `marks` is `x,y,w,h;x,y,w,h` in raw pixels. Without it, output is byte-identical to today.

- [ ] **Step 1: Add section `marks` to `check.sh`.** `marks.json` has all 16 keys (4 devices × 4 langs), each with exactly 2 rects, each rect inside the raw image's pixel bounds, and the field rect below the receipt rect.

- [ ] **Step 2: Run it to make sure it fails**

Run: `tools/check.sh marks`
Expected: `FAIL: marks.json missing`

- [ ] **Step 3: Write `find-marks.swift`.** `VNRecognizeTextRequest`, `.accurate`, language correction off. Receipt row: the observation whose text matches `^(VALOR )?TOTAL\b` (so `SUBTOTAL` never matches), unioned with every observation on the same row (vertical centres within half the row's height), so the amount is included. Field: digits-only of the receipt amount, then the lowest observation on screen whose digits-only text equals it and which is not on the receipt row (handles `187.500` on the receipt vs `187500` in the field). Convert Vision's normalised bottom-left boxes to raw pixels, top-left origin.

- [ ] **Step 4: Run it and check**

Run: `swift tools/find-marks.swift raw/*/*/01-review.png > marks.json && tools/check.sh marks`
Expected: pass. If one raw fails, fill its entry by hand from the image and note it in the commit message.

- [ ] **Step 5: Add marks to `frame.swift`.** Map each rect into the screen: `x' = screenX + x·screenW/rawW`, `y' = screenTop + (y − crop)·screenW/rawW`. Inside the existing screen clip, after drawing the raw, draw each rect padded by `0.6·u` as the brand yellow (`#FFD84A`, alpha 0.55) with `.multiply` blending, corner radius `0.8·u`, so the text stays dark. Join them with a dashed yellow line (`0.5·u` wide) from the bottom centre of the receipt mark to the top centre of the field mark.

- [ ] **Step 6: In `render.sh`, for slide `02-scan`, pass `marks.json["<dev>/<lang>"]` as `x,y,w,h;x,y,w,h`** (python3 one-liner like `caption()`).

- [ ] **Step 7: Render and check**

Run: `tools/render.sh && tools/check.sh`
Expected: all sections pass.

- [ ] **Step 8: Visual check.** `02-scan.png` for `appstore/iphone-6.9/en`, `appstore/ipad-13/id`, `appstore/duo-outer/es`, `appstore/duo-inner/pt-BR`: both marks sit on TOTAL and the Total field, and the line joins them.

- [ ] **Step 9: Commit**

```bash
git add store/screenshots/tools/find-marks.swift store/screenshots/marks.json store/screenshots/tools/frame.swift store/screenshots/tools/render.sh store/screenshots/tools/check.sh
git commit -m "feat(store): mark the read total on the scan slide"
```

### Task 4: Feature graphic, PNG check and docs

**Files:**
- Modify: `store/screenshots/tools/check.sh` (section `png`)
- Modify: `store/screenshots/tools/feature-graphic.swift` (header comment only)
- Modify: `docs/store/submit-screenshots-and-languages.md` (lines 20-22, 66, 68, 97-98, 139-141)
- Modify: `docs/store/submission-checklist.md` (the screenshots line under Done)

- [ ] **Step 1: Add section `png` to `check.sh`.** With `sips -g pixelWidth -g pixelHeight -g hasAlpha`: every output PNG has its target's size from `render.sh` `TARGETS` and `hasAlpha: no`; `out/play/feature/<lang>.png` is 1024×500.

- [ ] **Step 2: Rebuild the 4 feature graphics** with `zero-receipt.json` and the `feature` caption as subtitle, using the usage line in `feature-graphic.swift`. Update that file's header comment to name the `feature` caption.

- [ ] **Step 3: Run the full check**

Run: `tools/check.sh`
Expected: pass.

- [ ] **Step 4: Visual check.** `out/play/feature/en.png` and `es.png`: tagline wraps as "Free. Private." / "No ads." and stays clear of the receipt.

- [ ] **Step 5: Update the docs.** Seven files become eight, `00-free` to `07-trips`, with the upload order and a line saying `01-private` is drawn by `promo.swift` like `00-free`. Step 7 of "Rebuilding" uses the `feature` caption. Add `tools/check.sh` as the last rebuild step.

- [ ] **Step 6: Commit and push**

```bash
git add store/screenshots/tools docs/store
git commit -m "docs(store): 8-slide upload order and feature tagline"
git -c http.version=HTTP/1.1 push origin main
```

Expected: `git status` does not say "ahead".
