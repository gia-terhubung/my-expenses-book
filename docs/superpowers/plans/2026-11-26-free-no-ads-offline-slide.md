# Free / No ads / Offline slide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a "zero receipt" slide 1 (`00-free`) at every store size and new Play feature graphics, in en / id / es / pt-BR.

**Architecture:** Text lives in data files (`captions.json` key `00-free`, new `zero-receipt.json`). A new Swift script `tools/promo.swift` draws the slide; `render.sh` calls it once per target size and language. `feature-graphic.swift` is reused with the zero-receipt lines and the caption as subtitle.

**Tech Stack:** Swift scripts (AppKit / CoreGraphics), bash, `sips` for checks.

**Spec:** `docs/superpowers/specs/2026-11-26-free-no-ads-offline-slide-design.md`

## Global Constraints

- Output is opaque PNG (no alpha) at the exact sizes in `render.sh` TARGETS and 1024x500 for the feature graphic.
- Brand colours only: green #1F5C4C, page #F2F5F1, yellow #FFD84A, paper (0.985, 0.978, 0.962).
- Nothing says "forever"; the slip says the internet is optional.
- `out/` is git-ignored; only tools and data are committed.

## Review Focus

- Longest caption (es) must not overflow the header or the feature-graphic left column into the receipt.
- iPad 13" and Duo outer are short for their width: the slip must scale down to fit, not run off the bottom.
- Feature graphic: the slip must not be cut by the bottom torn edge.
- Non-ASCII text (ñ, ã, ç, ¡) must render in the mono font.
- `render.sh` must still produce the 6 existing shots unchanged.

---

### Task 1: Data and slide renderer

**Files:**
- Modify: `store/screenshots/captions.json` (add `00-free`)
- Create: `store/screenshots/zero-receipt.json`
- Create: `store/screenshots/tools/promo.swift`
- Modify: `store/screenshots/tools/render.sh`

**Interfaces:**
- Produces: `promo.swift <font.ttf> <zero-receipt.json> <lang> <W> <H> <caption> <out.png>`; `zero-receipt.json` = `{lang: ["name\tamount" | "text"]}`, first line is the shop name, a line starting `TOTAL` gets the highlighter.

- [ ] Step 1: Add captions: en "Free. No ads. Works offline.", id "Gratis. Tanpa iklan. Bisa offline.", es "Gratis. Sin anuncios. Funciona sin internet.", pt-BR "Grátis. Sem anúncios. Funciona offline."
- [ ] Step 2: Add slip lines per language (values from the spec: price 0 / ads 0 / tracking 0 / account none / internet optional / TOTAL 0; id amounts `0`, es and pt-BR `0,00`; a closing thank-you line).
- [ ] Step 3: Write `promo.swift`: the header copied from `frame.swift`, then the slip centred under it, tilted about -1.5°, scaled to fit the space left, scalloped bottom edge.
- [ ] Step 4: In `render.sh`, after the raw loop, render `00-free.png` for each TARGETS row and language (only where that target folder already exists in `out/`).
- [ ] Step 5: Run `store/screenshots/tools/render.sh`; check with `sips -g pixelWidth -g pixelHeight -g hasAlpha` that every `00-free.png` is the target size with `hasAlpha: no`; look at the iPhone, iPad and Duo outer images for each language.
- [ ] Step 6: Commit.

### Task 2: Feature graphic

**Files:**
- Modify: `store/screenshots/tools/feature-graphic.swift`
- Modify: `docs/store/submit-screenshots-and-languages.md` (step 7 and slide-1 note)

- [ ] Step 1: Wrap the subtitle in a 470 px wide box; centre a non-tab last line (the thank-you) on the slip.
- [ ] Step 2: Run it per language with `zero-receipt.json` and the `00-free` caption into `out/play/feature/<lang>.png`.
- [ ] Step 3: Check 1024x500, no alpha; look at all four.
- [ ] Step 4: Update the doc; commit.
