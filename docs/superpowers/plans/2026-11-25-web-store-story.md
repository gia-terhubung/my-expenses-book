# Web store-listing story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the landing page around the six store scenes with the 2026-11-24 screenshots, plus an iPhone Duo band.

**Architecture:** Screenshot table moves to per-device sizes; `PhoneShot` reads the device from the table. New
`Story` and `Devices` sections replace `HowItWorks`; `Features` and `TipJar` lose their screenshots.

**Tech Stack:** Next.js 16 static export, CSS modules, Vitest + Testing Library, sharp.

**Spec:** `docs/superpowers/specs/2026-11-25-web-store-story-design.md`

## Global Constraints

- No new colours, fonts, client JS or third-party requests. Contrast at least 4.5:1, light and dark.
- English only. Copy lives in `src/content/landing.ts`; components carry no prose.
- Every claim true of the app as built; screenshots are synthetic seed data only.

## Review Focus

- 375px phone width: Duo inner frame must not overflow the gutter (frame `width: 100%`, `max-width`).
- Dark mode: frame and caption contrast on the tonal band.
- Image sizes: `width`/`height` attributes match each webp, or layout shifts.
- `check-out.mjs` still passes (every referenced `/screenshots/*.webp` exists in `out/`).
- Old webp files removed so `out/` carries no dead images.

---

### Task 1: Screenshot table and pipeline

**Files:** Modify `src/content/screenshots.ts`, `scripts/prepare-screenshots.mjs`, `screenshots-src/README.md`;
replace `public/screenshots/*.webp`; delete `screenshots-src/*.png`.

**Produces:** `type Device = "iphone" | "duo-outer" | "duo-inner"`; `type ShotId = "review" | "home" | "zoom" |
"stats" | "trip" | "search" | "duo-outer-home" | "duo-inner-home"`; `Shot = { id, device, alt, width, height }`;
`SHOTS: Record<ShotId, Shot>`; `shotSrc(id)`. The `ready` flag and placeholder go (every shot exists).

Sizes: iphone 780x1695 (from 1320x2868), duo-inner 900x1279 (from 2007x2853), duo-outer 560x815 (from 1398x2034).
Script reads `../../store/screenshots/raw/<iphone|duo-outer|duo-inner>/en/<NN-scene>.png`, checks source size, writes
`public/screenshots/<id>.webp`, quality 82.

- [ ] Rewrite table + script, run `npm run screenshots`, expect 8 "wrote" lines.
- [ ] Commit.

### Task 2: PhoneShot per device

**Files:** `src/components/PhoneShot.tsx`, `.module.css`, `.test.tsx`.

`PhoneShot({ id, eager?, shots? })`; frame gets `data-device={shot.device}`; image uses shot width/height;
aspect-ratio from width/height via inline style. Radii: iphone 44/36, duo-outer 40/32, duo-inner 30/22.
Max widths: iphone 300, duo-outer 260, duo-inner 420.

- [ ] Tests: renders img with alt, `width`/`height` from table, `data-device`, lazy by default, eager when asked.
- [ ] Implement, `npm test`, commit.

### Task 3: Story, Devices, slimmer Features and TipJar, page

**Files:** Create `src/components/Story.tsx(.module.css)`, `src/components/Devices.tsx(.module.css)`; modify
`src/content/landing.ts`, `src/components/Features.tsx(.module.css)`, `src/components/TipJar.tsx(.module.css)`,
`src/app/page.tsx`, `src/app/page.test.tsx`; delete `HowItWorks.*`.

Content: `story = { id: "how-it-works", title: "How the book works", scenes: [{ shot, title, body }] }` with the
five store captions (home, zoom, stats, trip, search); `devices = { id: "fits-your-screen", title: "Fits your
screen", body, shots: [{ shot: "duo-outer-home", caption: "Folded" }, { shot: "duo-inner-home", caption: "Unfolded" }] }`;
`features.title = "What else the book does"` with items Folders and tax years, Export, Backup, App lock, Languages;
`tipJar` without `shot`; `hero.shot = "review"`.

- [ ] Test: h2 order `[story, devices, privacyPromise, features, audiences, tipJar]`; every scene h3 present;
  both Duo captions present.
- [ ] Implement, `npm run check` passes, commit.

### Task 4: Verify in a browser and push

- [ ] `npm run build`, serve `out/`, check 375px and 1280px, light and dark.
- [ ] `git push` (HTTP/1.1 retry if sideband disconnect).
