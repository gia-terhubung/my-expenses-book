# Web Landing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public site for My Expenses Book at `meb.terhubung.app`: a landing page, `/privacy` and `/terms`, as a static Next.js export with no third-party requests.

**Architecture:** Next.js 16 App Router in `apps/web`, exported to static files (`output: "export"`). Server Components only. All copy is data in `src/content/`; components render it and style it with CSS Modules that use the `--color-*`, `--space-*` and `--text-*` variables from `src/app/globals.css`.

**Tech Stack:** Next.js 16.4, React 19, TypeScript, CSS Modules, `next/font` (Bricolage Grotesque), Vitest + Testing Library (jsdom), `sharp` (dev only, image scripts), Vercel.

**Spec:** `docs/superpowers/specs/2026-11-17-web-landing-design.md`. Read it before any task: it holds the wireframes, the type scale and the screenshot rules.

## Global Constraints

- Work only in `apps/web`. Never edit `apps/mobile` or `site/`. Never read `apps/mobile/spikes/receipts/`, `spikes/ocr-dumps/` or `spikes/ocr-samples/`.
- Read `apps/web/AGENTS.md` first: this Next.js version differs from older ones; its docs are in `apps/web/node_modules/next/dist/docs/`.
- No `"use client"` files. No new runtime dependency. No Tailwind. No analytics, cookies, or any URL to another origin in `src`, `href` (except `<a>` links in the legal text) or CSS.
- No prose in components. Copy comes from `src/content/landing.ts`, `privacy.ts`, `terms.ts`. Do not reword it. Do not add features, numbers or claims.
- No raw hex colour in any `*.module.css` or `*.tsx`. Use `var(--color-…)`. A colour pair used for text must already be in `textPairs` in `src/theme/tokens.ts`; if it is not, add it there first and keep the test green.
- Yellow (`--color-highlight`) appears only inside `.slip`, and as the fill of the tip note with `--color-on-highlight` text.
- Sentence case. No all-caps labels. No label above a heading. No arrow characters in link text.
- Mobile-first CSS. Breakpoints: `600px`, `768px`, `900px` only. No horizontal scroll at 320px.
- Interactive targets in the header, footer and badges are at least 48px high.
- Use `<Image>` from `next/image` with explicit `width` and `height`; use `loading="eager"`, not the deprecated `priority`.
- Every task ends with `npm run lint && npm run typecheck && npm test && npm run build` passing in `apps/web`, then one commit. Commit only files under `apps/web`.
- Commit messages: `feat(web): …` / `test(web): …` / `docs(web): …`.

## Review Focus

1. **A store link is set for one store only** (`appStore` URL, `googlePlay` null): one live link and one disabled badge, not two of either. Test in Task 2.
2. **A screenshot is `ready: true` but the file is missing**: the build check must fail, not ship a broken image. Test in Task 11 (`check-out.mjs`).
3. **Dark mode**: every section must read correctly with the dark tokens; no colour may be hard-coded. Enforced in Task 11 (raw-hex check) and viewed in Task 13.
4. **Long words at 320px** (`halo@terhubung.app`, `cdn.jsdelivr.net`, `@fawazahmed0/currency-api`): must wrap, not overflow. `code` already has `overflow-wrap: anywhere`; Task 9 adds it to legal links. Viewed in Task 13.
5. **Legal inline marks with unusual input**: text with no marks, two marks in one string, a mark at the very start or end, and a `mailto:` link. Tests in Task 9.

## File Structure

Already present (Task 1):

```
apps/web/
  next.config.ts            static export
  vitest.config.mts, vitest.setup.ts
  src/config/site.ts        SITE, STORE_LINKS
  src/theme/tokens.ts       lightColors, darkColors, textPairs, contrastRatio, cssVarName (+ tokens.test.ts)
  src/content/landing.ts    hero, storeBadges, howItWorks, privacyPromise, features, audiences, tipJar, notFound
  src/content/screenshots.ts  ShotId, Shot, SHOTS, SHOT_WIDTH, SHOT_HEIGHT, shotSrc
  src/content/legal-types.ts  LegalBlock, LegalSection, LegalDoc
  src/content/privacy.ts, terms.ts (+ legal.test.ts)
  src/components/SiteHeader, SiteFooter (+ SiteFooter.test.tsx), PageSlip (+ .module.css), LogoMark
  src/app/layout.tsx, globals.css, page.tsx, privacy/page.tsx, terms/page.tsx, robots.ts, sitemap.ts, icon.svg
  public/logo/*.svg, public/screenshots/
```

Added by this plan:

```
  src/components/StoreBadges.tsx (+ .module.css, .test.tsx)        Task 2
  src/components/PhoneShot.tsx (+ .module.css, .test.tsx)          Task 3
  src/components/Section.tsx (+ .module.css)                       Task 5
  src/components/HowItWorks.tsx (+ .module.css)                    Task 5
  src/components/PrivacyReceipt.tsx (+ .module.css)                Task 6
  src/components/Features.tsx, Audiences.tsx (+ .module.css)       Task 7
  src/components/TipJar.tsx (+ .module.css)                        Task 8
  src/app/page.test.tsx                                            Task 8
  src/components/legal/renderInline.tsx (+ .test.tsx)              Task 9
  src/components/legal/LegalDocument.tsx (+ .module.css, .test.tsx) Task 9
  src/app/not-found.tsx, apple-icon.png, opengraph-image.png       Task 10
  scripts/make-brand-images.mjs, scripts/prepare-screenshots.mjs   Task 10
  scripts/check-out.mjs                                            Task 11
  vercel.json, DEPLOY.md                                           Task 12
```

Shared CSS facts every task may use (from `globals.css`): classes `container`, `measure`, `lead`, `small`, `muted`, `figures`, `visually-hidden`, `slip`, `slip-torn`, `slip-muted`, `total-bar`; variables `--space-1`…`--space-9` (4, 8, 12, 16, 24, 32, 48, 72, 112px), `--radius-control` (14px), `--radius-pill`, `--shadow-raised`, `--tear` (10px), `--font-display`, `--font-body`, `--text-display|h2|h3|lead|body|small`. Display type is applied with `font-family: var(--font-display), var(--font-body)`.

---

### Task 1: Scaffold (done by the lead)

Done in commit `feat(web): scaffold landing site (Next.js) with spec and plan`. Nothing to do. Check the baseline before starting Task 2:

- [x] `cd apps/web && npm install && npm run lint && npm run typecheck && npm test && npm run build` all pass; `out/index.html`, `out/privacy.html`, `out/terms.html` exist.

---

### Task 2: Store badges

**Files:**
- Create: `src/components/StoreBadges.tsx`, `src/components/StoreBadges.module.css`
- Test: `src/components/StoreBadges.test.tsx`

**Interfaces:**
- Consumes: `STORE_LINKS` from `@/config/site`; `storeBadges` from `@/content/landing`.
- Produces: `StoreBadges({ links }: { links?: { appStore: string | null; googlePlay: string | null } })`. `links` defaults to `STORE_LINKS`. Used inside `.slip` only.

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StoreBadges } from "./StoreBadges";

describe("StoreBadges", () => {
  it("shows two disabled badges and no link before launch", () => {
    render(<StoreBadges links={{ appStore: null, googlePlay: null }} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("App Store").closest("[data-store]")).toHaveAttribute("data-state", "soon");
    expect(screen.getByText("Google Play").closest("[data-store]")).toHaveAttribute("data-state", "soon");
    expect(screen.getAllByText("Coming soon")).toHaveLength(2);
  });

  it("links a store once its URL is set, and leaves the other disabled", () => {
    render(<StoreBadges links={{ appStore: "https://apps.apple.com/app/id1", googlePlay: null }} />);
    const link = screen.getByRole("link", { name: "Download on App Store" });
    expect(link).toHaveAttribute("href", "https://apps.apple.com/app/id1");
    expect(screen.getAllByText("Coming soon")).toHaveLength(1);
    expect(screen.getByText("Google Play").closest("[data-store]")).toHaveAttribute("data-state", "soon");
  });

  it("is a labelled list", () => {
    render(<StoreBadges links={{ appStore: null, googlePlay: null }} />);
    expect(screen.getByRole("list", { name: "Get the app" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run `npm test -- StoreBadges`. Expected: FAIL, cannot resolve `./StoreBadges`.**

- [ ] **Step 3: Implement `StoreBadges`**

Markup: `<ul aria-label="Get the app">` with two `<li>`, App Store first. Each badge is an element with `data-store="app-store" | "google-play"` and `data-state="soon" | "live"`, holding two `<span>`s: a small top line and a strong bottom line (the store name). Null URL: a `<span>` badge, top line `storeBadges.comingSoon`. URL set: an `<a href>` badge, top line `storeBadges.download`. The two lines are separated by a space text node so the accessible name reads "Download on App Store". No store logos.

CSS: list is `display: flex; flex-wrap: wrap; gap: var(--space-3); padding: 0; list-style: none; margin-top: var(--space-5)`. Badge: `display: inline-flex; flex-direction: column; justify-content: center; min-height: 56px; min-width: 168px; padding: var(--space-2) var(--space-5); border-radius: var(--radius-control); text-decoration: none`. Top line `var(--text-small)`, line-height 1.2; bottom line display font, 800, `1.125rem`, line-height 1.2. `soon`: `border: 1.5px dashed var(--color-slip-muted); color: var(--color-slip-muted); cursor: default`. `live`: `background: var(--color-slip-text); color: var(--color-slip)` (the selector must beat `.slip a`: use `a.badge`); hover `background: var(--color-slip-muted)`.

- [ ] **Step 4: Run `npm test -- StoreBadges`. Expected: 3 passed.**

- [ ] **Step 5: Run the full check and commit** as `feat(web): store badges driven by STORE_LINKS`.

---

### Task 3: Phone frame with screenshot or placeholder

**Files:**
- Create: `src/components/PhoneShot.tsx`, `src/components/PhoneShot.module.css`
- Test: `src/components/PhoneShot.test.tsx`

**Interfaces:**
- Consumes: `SHOTS`, `SHOT_WIDTH`, `SHOT_HEIGHT`, `shotSrc`, `type Shot`, `type ShotId` from `@/content/screenshots`.
- Produces: `PhoneShot({ id, size, eager, shots }: { id: ShotId; size?: "md" | "sm"; eager?: boolean; shots?: Record<ShotId, Shot> })`. Defaults: `size = "md"`, `eager = false`, `shots = SHOTS` (the `shots` prop exists for tests).

- [ ] **Step 1: Write the failing tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SHOTS } from "@/content/screenshots";
import { PhoneShot } from "./PhoneShot";

describe("PhoneShot", () => {
  it("draws a marked placeholder while the screenshot is not ready", () => {
    const { container } = render(<PhoneShot id="home-slip" />);
    const placeholder = screen.getByRole("img", { name: "Screenshot placeholder: Home" });
    expect(placeholder).toHaveAttribute("data-placeholder", "home-slip");
    expect(placeholder).toHaveTextContent("Screenshot placeholder");
    expect(placeholder).toHaveTextContent("home-slip.webp");
    expect(container.querySelector("img")).toBeNull();
  });

  it("draws the image with its alt text and size once ready", () => {
    const shots = { ...SHOTS, review: { ...SHOTS.review, ready: true } };
    const { container } = render(<PhoneShot id="review" shots={shots} />);
    const img = screen.getByRole("img", { name: SHOTS.review.alt });
    expect(img.getAttribute("src")).toContain("/screenshots/review.webp");
    expect(img).toHaveAttribute("width", "780");
    expect(img).toHaveAttribute("height", "1695");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(container.querySelector("[data-placeholder]")).toBeNull();
  });

  it("loads eagerly when asked", () => {
    const shots = { ...SHOTS, "home-slip": { ...SHOTS["home-slip"], ready: true } };
    render(<PhoneShot id="home-slip" eager shots={shots} />);
    expect(screen.getByRole("img")).toHaveAttribute("loading", "eager");
  });
});
```

- [ ] **Step 2: Run `npm test -- PhoneShot`. Expected: FAIL, cannot resolve `./PhoneShot`.**

- [ ] **Step 3: Implement `PhoneShot`**

Markup: `<div class="frame" data-size={size}>` wrapping either `<Image src={shotSrc(id)} alt={shot.alt} width={SHOT_WIDTH} height={SHOT_HEIGHT} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} class="screen" />` or `<div role="img" aria-label={"Screenshot placeholder: " + shot.screen} data-placeholder={id} class="screen placeholder">` containing three `<span>`s: `Screenshot placeholder`, `shot.screen`, `` `${id}.webp` ``. These three placeholder strings are the only literal text allowed in a component.

CSS: `.frame { width: 100%; max-width: 300px; padding: 8px; border-radius: 44px; background: var(--color-frame); box-shadow: var(--shadow-raised); }` `.frame[data-size="sm"] { max-width: 240px; border-radius: 36px; }` `.screen { display: block; width: 100%; height: auto; aspect-ratio: 780 / 1695; border-radius: 36px; }` (28px for `sm`). `.placeholder`: flex column, centred, `gap: var(--space-2)`, `padding: var(--space-4)`, `text-align: center`, `color: var(--color-text)`, `font-size: var(--text-small)`, background `repeating-linear-gradient(45deg, var(--color-tonal) 0 14px, var(--color-border) 14px 15px)`; first span weight 700; third span in the `code` font.

- [ ] **Step 4: Run `npm test -- PhoneShot`. Expected: 3 passed.**

- [ ] **Step 5: Run the full check and commit** as `feat(web): phone frame with screenshot placeholder`.

---

### Task 4: Complete the hero

**Files:**
- Modify: `src/components/PageSlip.tsx`, `src/components/PageSlip.module.css`, `src/app/page.tsx`
- Create: `src/app/page.module.css`

**Interfaces:**
- Consumes: `StoreBadges` (Task 2), `PhoneShot` (Task 3), `hero` from `@/content/landing`.
- Produces: `PageSlip` gains `overhang?: boolean` (default `false`). When true, the `aside` hangs below the torn edge and plays the load animation.

- [ ] **Step 1: Add `overhang` to `PageSlip`.** When `overhang` is true add the class `styles.overhang` to the `<section>`.

CSS to add:

```css
.overhang { margin-bottom: calc(var(--tear) + var(--space-8)); }
.overhang .aside {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  margin-bottom: calc(-1 * (var(--space-7) + var(--space-8)));
  animation: print 600ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
}
@keyframes print { from { transform: translateY(-24px); opacity: 0; } }
@media (min-width: 900px) {
  .overhang .aside { margin-bottom: calc(-1 * (var(--space-8) + var(--space-8))); }
}
```

The `.slip` padding-bottom is `--space-7` (mobile) and `--space-8` (900px up), so the phone ends `--space-8` below the slip in both cases. Reduced motion is already handled globally.

- [ ] **Step 2: Fill the hero in `src/app/page.tsx`.** `<PageSlip title={hero.title} lead={hero.lead} overhang aside={<PhoneShot id={hero.shot} eager />}>` with two children: `<StoreBadges />`, then `<p className={`small slip-muted ${styles.note}`}>{hero.note}</p>`. Create `src/app/page.module.css` with `.note { margin-top: var(--space-4); max-width: 34rem; }` and import it as `styles`.

- [ ] **Step 3: Run `npm run build`, then `npm run start` and open `http://localhost:3000`.** Expected: the badges read "Coming soon / App Store" and "Coming soon / Google Play" with dashed outlines; the placeholder phone crosses the torn edge; at 360px wide nothing scrolls sideways.

- [ ] **Step 4: Run the full check and commit** as `feat(web): hero with store badges and screenshot`.

---

### Task 5: Section wrapper and "How it works"

**Files:**
- Create: `src/components/Section.tsx`, `Section.module.css`, `src/components/HowItWorks.tsx`, `HowItWorks.module.css`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `howItWorks` from `@/content/landing`; `PhoneShot`.
- Produces: `Section({ id, title, band, children }: { id: string; title: string; band?: boolean; children: ReactNode })` renders `<section id={id} aria-labelledby={id + "-title"}>` > `.container` > `<h2 id={id + "-title"}>` then children. `band` gives the section the `tonal` background. `HowItWorks()` takes no props.

- [ ] **Step 1: Implement `Section`.** CSS: `.section { padding-block: var(--space-7); }` and from 900px `var(--space-8)`; `.section h2 { max-width: 20ch; margin-bottom: var(--space-6); }`; `.band { background: var(--color-tonal); }`.

- [ ] **Step 2: Implement `HowItWorks`.** `<Section id={howItWorks.id} title={howItWorks.title}>` > `<ol class="steps">`; each `<li>`: `<PhoneShot id={step.shot} size="sm" />`, then `<h3>` with the step name, then `<p>` with the body. The step number comes from a CSS counter, not from text.

CSS: `.steps { list-style: none; padding: 0; display: grid; gap: var(--space-7); counter-reset: step; }` from 900px `grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-6);`. `li { counter-increment: step; }`. `h3 { margin-top: var(--space-5); display: flex; align-items: baseline; gap: var(--space-3); }` `h3::before { content: counter(step); font-size: 2.5rem; line-height: 1; font-weight: 800; color: var(--color-primary); }`. `p { margin-top: var(--space-2); max-width: 34ch; }`.

- [ ] **Step 3: Add `<HowItWorks />` after the hero in `page.tsx`** (wrap the page in a fragment).

- [ ] **Step 4: Run the full check; view at 360px and 1280px; commit** as `feat(web): how it works section`.

---

### Task 6: Privacy promise with the zero receipt

**Files:**
- Create: `src/components/PrivacyReceipt.tsx`, `PrivacyReceipt.module.css`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `privacyPromise` from `@/content/landing`; `Section`; `Link` from `next/link`.
- Produces: `PrivacyReceipt()`, no props.

- [ ] **Step 1: Implement `PrivacyReceipt`.** Inside `<Section id={privacyPromise.id} title={privacyPromise.title}>` a `.split` grid with two children:

1. `.text`: `<p class="lead">` body; `<h3>` `networkTitle`; `<ol>` with one `<li>` per `network` item as `<strong>{name}</strong> {body}`; `<p>` with `<Link href={linkHref}>{linkLabel}</Link>`.
2. `.paper` (an `<aside aria-label={receipt.heading}>`): `<h3>` heading; `<dl class="rows figures">` where each row is a `<div class="row">` with `<dt>` label and `<dd>` value; then `<div class="row total">` with `<dt>` `totalLabel` and `<dd>` `totalValue`.

CSS: `.split { display: grid; gap: var(--space-7); }` from 900px `grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: var(--space-8);`. `.text` children spaced by `margin-top: var(--space-5)`; `ol { padding-left: 1.25rem; } li + li { margin-top: var(--space-3); }`; `.text { max-width: 36rem; }`. On mobile the paper comes second in the DOM and stays second.

`.paper { position: relative; width: 100%; max-width: 340px; padding: var(--space-5) var(--space-5) var(--space-6); background: var(--color-surface); transform: rotate(-1.5deg); margin-bottom: var(--tear); }` with a torn bottom edge: `.paper::after { content: ""; position: absolute; left: 0; right: 0; top: 100%; height: var(--tear); background: radial-gradient(circle at 10px 0, var(--color-surface) 7.5px, transparent 8px) repeat-x; background-size: 20px var(--tear); }`. `.row { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-4); padding-block: var(--space-2); border-bottom: 1px dotted var(--color-border); }` `dd { font-family: var(--font-display), var(--font-body); font-weight: 700; }` `.total { margin-top: var(--space-3); padding-top: var(--space-3); border-top: 2px solid var(--color-text); border-bottom: 0; } .total dt { font-weight: 700; } .total dd { font-size: 2.5rem; line-height: 1; font-weight: 800; color: var(--color-primary); }`.

- [ ] **Step 2: Add `<PrivacyReceipt />` after `<HowItWorks />`.**

- [ ] **Step 3: Run the full check; view light and dark; commit** as `feat(web): privacy promise with zero receipt`.

---

### Task 7: Features and audiences

**Files:**
- Create: `src/components/Features.tsx`, `Features.module.css`, `src/components/Audiences.tsx`, `Audiences.module.css`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `features`, `audiences` from `@/content/landing`; `Section`; `PhoneShot`.
- Produces: `Features()`, `Audiences()`, no props.

- [ ] **Step 1: Implement `Features`.** `<Section id={features.id} title={features.title}>` > `.split` with `<dl class="list">` (each item a `<div class="item">` with `<dt>` name and `<dd>` body) and `<PhoneShot id={features.shot} />` in a `.shot` div.

CSS: `.split { display: grid; gap: var(--space-7); }` from 900px `grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-8); align-items: start;`. `.list { display: grid; gap: var(--space-5) var(--space-6); }` from 600px `grid-template-columns: repeat(2, minmax(0, 1fr));`. `.item { padding-top: var(--space-4); border-top: 1px solid var(--color-border); }` `dt { font-family: var(--font-display), var(--font-body); font-weight: 700; font-size: var(--text-h3); line-height: 1.25; }` `dd { margin-top: var(--space-2); color: var(--color-text-muted); }`. `.shot { display: flex; justify-content: center; }`.

- [ ] **Step 2: Implement `Audiences`.** `<Section id={audiences.id} title={audiences.title} band>` > `<ul class="list">`; each `<li>`: `<h3>` name, `<p>` body. CSS: `.list { list-style: none; padding: 0; display: grid; gap: var(--space-6); }` from 768px `grid-template-columns: repeat(3, minmax(0, 1fr));`. `p { margin-top: var(--space-2); }`. Text colour stays `--color-text` (the pair `text` on `tonal` is tested).

- [ ] **Step 3: Add `<Features />` then `<Audiences />` to `page.tsx`.**

- [ ] **Step 4: Run the full check and commit** as `feat(web): features and audiences sections`.

---

### Task 8: Tip jar section and the landing page test

**Files:**
- Create: `src/components/TipJar.tsx`, `TipJar.module.css`
- Modify: `src/app/page.tsx`, `src/components/SiteFooter.module.css` (set `.footer { margin-top: 0; }`)
- Test: `src/app/page.test.tsx`

**Interfaces:**
- Consumes: `tipJar` from `@/content/landing`; `Section`; `PhoneShot`.
- Produces: `TipJar()`, no props. Final section order in `page.tsx`: hero, `HowItWorks`, `PrivacyReceipt`, `Features`, `Audiences`, `TipJar`.

- [ ] **Step 1: Write the failing page test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { audiences, features, hero, howItWorks, privacyPromise, tipJar } from "@/content/landing";
import HomePage from "./page";

describe("landing page", () => {
  it("has one h1 and the six section headings in order", () => {
    render(<HomePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(hero.title);
    const h2 = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(h2).toEqual([howItWorks.title, privacyPromise.title, features.title, audiences.title, tipJar.title]);
  });

  it("names the three network uses next to the privacy promise", () => {
    render(<HomePage />);
    for (const item of privacyPromise.network) expect(screen.getByText(item.name)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: privacyPromise.linkLabel })).toHaveAttribute("href", "/privacy");
  });

  it("says that tips unlock nothing", () => {
    render(<HomePage />);
    expect(screen.getByText(tipJar.note)).toBeInTheDocument();
  });

  it("shows every feature and audience", () => {
    render(<HomePage />);
    // getAllByText: a feature name can also appear on a screenshot placeholder ("Statistics").
    for (const item of [...features.items, ...audiences.items]) expect(screen.getAllByText(item.name).length).toBeGreaterThan(0);
  });
});
```

Note: `next/link` and `next/image` render in Vitest without mocks. If `next/font` is ever imported by a tested file, mock it; `page.tsx` must not import it.

- [ ] **Step 2: Run `npm test -- page`. Expected: FAIL on the h2 list (no tip jar heading yet).**

- [ ] **Step 3: Implement `TipJar`.** `<Section id={tipJar.id} title={tipJar.title}>` > `.split`: `.text` with `<p class="lead">` body and `<p class="note">` note; `.shot` with `<PhoneShot id={tipJar.shot} size="sm" />`.

CSS: `.split { display: grid; gap: var(--space-6); }` from 768px `grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: var(--space-8);` with `.shot { order: -1; }` at that width. `.text { max-width: 34rem; }` `.note { display: inline-block; margin-top: var(--space-5); padding: var(--space-3) var(--space-4); border-radius: var(--radius-control); background: var(--color-highlight); color: var(--color-on-highlight); font-weight: 600; }`.

- [ ] **Step 4: Run `npm test -- page`. Expected: 4 passed.**

- [ ] **Step 5: Run the full check and commit** as `feat(web): tip jar section and landing page test`.

---

### Task 9: Legal pages

**Files:**
- Create: `src/components/legal/renderInline.tsx`, `src/components/legal/LegalDocument.tsx`, `src/components/legal/LegalDocument.module.css`
- Modify: `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`
- Test: `src/components/legal/renderInline.test.tsx`, `src/components/legal/LegalDocument.test.tsx` (`src/content/legal.test.ts` already exists)

**Interfaces:**
- Consumes: `LegalDoc`, `LegalBlock` from `@/content/legal-types`; `privacy`, `terms`.
- Produces:
  - `renderInline(text: string): ReactNode[]`. Turns `**bold**` into `<strong>`, `` `code` `` into `<code>`, `[label](href)` into a link. `href` starting with `/` uses `next/link`; any other `href` is a plain `<a>`, and `https:` links get `rel="noopener noreferrer"`. Marks do not nest. Text with no marks returns one string.
  - `formatEffectiveDate(iso: string): string`, exported from `LegalDocument.tsx`: `"2026-11-17"` gives `"17 November 2026"` (use `toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })` on `new Date(iso + "T00:00:00Z")`).
  - `LegalDocument({ doc }: { doc: LegalDoc })`.

- [ ] **Step 1: Write the failing tests**

`renderInline.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderInline } from "./renderInline";

const html = (text: string) => render(<p>{renderInline(text)}</p>).container.querySelector("p")!.innerHTML;

describe("renderInline", () => {
  it("returns plain text unchanged", () => {
    expect(html("No marks here.")).toBe("No marks here.");
  });
  it("renders bold at the start and code in the middle", () => {
    expect(html("**Tips.** Rates come from `cdn.jsdelivr.net` only.")).toBe(
      "<strong>Tips.</strong> Rates come from <code>cdn.jsdelivr.net</code> only.",
    );
  });
  it("renders a mailto link at the end", () => {
    expect(html("Questions: [halo@terhubung.app](mailto:halo@terhubung.app)")).toBe(
      'Questions: <a href="mailto:halo@terhubung.app">halo@terhubung.app</a>',
    );
  });
  it("renders an external link with rel and an internal link without", () => {
    expect(html("See [the disclosure](https://developers.google.com/ml-kit/android-data-disclosure).")).toBe(
      'See <a href="https://developers.google.com/ml-kit/android-data-disclosure" rel="noopener noreferrer">the disclosure</a>.',
    );
    expect(html("Our [privacy policy](/privacy) explains.")).toContain('<a href="/privacy">privacy policy</a>');
  });
  it("leaves an unclosed mark as text", () => {
    expect(html("2 ** 3 is 8")).toBe("2 ** 3 is 8");
  });
});
```

`LegalDocument.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { privacy } from "@/content/privacy";
import { formatEffectiveDate, LegalDocument } from "./LegalDocument";

describe("LegalDocument", () => {
  it("formats the effective date", () => {
    expect(formatEffectiveDate("2026-11-17")).toBe("17 November 2026");
  });
  it("renders every section as an anchored h2, and no h1", () => {
    const { container } = render(<LegalDocument doc={privacy} />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    const h2 = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(h2).toEqual(privacy.sections.map((s) => s.heading));
    for (const s of privacy.sections) expect(container.querySelector(`section#${s.id}`)).not.toBeNull();
    expect(screen.getByText("Effective 17 November 2026")).toBeInTheDocument();
  });
  it("renders ordered and unordered lists", () => {
    const { container } = render(<LegalDocument doc={privacy} />);
    expect(container.querySelectorAll("ol > li")).toHaveLength(3);
    expect(container.querySelectorAll("ul").length).toBeGreaterThanOrEqual(2);
  });
});
```

`src/content/legal.test.ts` already exists (Task 1) and guards the facts in both documents. Do not edit it; if it fails, the content was changed and must be restored.

- [ ] **Step 2: Run `npm test -- legal`. Expected: `src/content/legal.test.ts` passes; the two new test files FAIL (modules missing).**

- [ ] **Step 3: Implement `renderInline`** with one regular expression that matches the three marks in a single left-to-right pass: `/\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g`. Give each returned element a `key`.

- [ ] **Step 4: Implement `LegalDocument`.** `<article class="container doc">` > `<div class="measure">`: `<p class="small muted">Effective {formatEffectiveDate(doc.effectiveDate)}</p>`; the intro blocks; then per section `<section id={s.id}><h2>{s.heading}</h2>…blocks…</section>`. A block renders as `<p>`, `<ul>` or `<ol>` with `renderInline` on every string. The word "Effective" is the one literal allowed here.

CSS: `.doc { padding-block: var(--space-7) var(--space-8); font-size: 1.0625rem; line-height: 1.65; }` `.doc h2 { font-size: 1.375rem; line-height: 1.25; letter-spacing: 0; margin-top: var(--space-7); scroll-margin-top: var(--space-5); }` `.doc p, .doc ul, .doc ol { margin-top: var(--space-4); }` `.doc ul, .doc ol { padding-left: 1.375rem; }` `.doc li + li { margin-top: var(--space-3); }` `.doc a { overflow-wrap: anywhere; }`.

- [ ] **Step 5: Use it in both pages.** In `privacy/page.tsx` and `terms/page.tsx` return a fragment: the existing `<PageSlip …/>` then `<LegalDocument doc={…} />`. Remove the "Scaffold stub" comment. Keep the metadata.

- [ ] **Step 6: Run `npm test`. Expected: all pass. Run the full check and commit** as `feat(web): privacy and terms pages`.

---

### Task 10: 404 page, brand images and the screenshot script

**Files:**
- Create: `src/app/not-found.tsx`, `scripts/make-brand-images.mjs`, `scripts/prepare-screenshots.mjs`, `src/app/apple-icon.png`, `src/app/opengraph-image.png`, `screenshots-src/README.md`
- Modify: `package.json` (devDependency `sharp`; scripts `brand-images`, `screenshots`), `src/app/layout.tsx` (Open Graph image alt text)

**Interfaces:**
- Consumes: `notFound` from `@/content/landing`; `PageSlip`; `public/logo/meb-long-page.svg`.
- Produces: `npm run brand-images`, `npm run screenshots`.

- [ ] **Step 1: `not-found.tsx`.** `<PageSlip title={notFound.title} lead={notFound.lead}>` with child `<p style margin-top var(--space-5) via a CSS module><Link href="/">{notFound.linkLabel}</Link></p>`. Export `metadata = { title: "Page not found" }`.

- [ ] **Step 2: Install sharp.** `npm i -D sharp`.

- [ ] **Step 3: `scripts/make-brand-images.mjs`** (Node ESM, run from `apps/web`). It writes two files with `sharp`:
  - `src/app/apple-icon.png`: `public/logo/meb-long-page.svg` rendered at 180×180.
  - `src/app/opengraph-image.png`: 1200×630, built from an inline SVG string: background `#1F5C4C`; the logo SVG composited at 200×200 at x=80, y=96 with a 44px corner radius mask; the text "My Expenses Book" at x=80, y=400, `font-size 84`, `font-weight 800`, fill `#FFFFFF`; a yellow bar `#FFD84A` 88×10, radius 5, at x=80, y=432; the text "Scan a receipt. Keep the record, not the paper." at x=80, y=520, `font-size 40`, fill `#BFD9CF`. Use `font-family="Helvetica, Arial, sans-serif"` (build-machine fonts; the image is committed, so it is made once). These hex values are allowed here because the script is not site CSS.
  Add `"brand-images": "node scripts/make-brand-images.mjs"` to `package.json`.

- [ ] **Step 4: Run `npm run brand-images`.** Expected: both PNG files exist; open `opengraph-image.png` and confirm no text is cut off. Commit the PNGs. In `layout.tsx` add `openGraph.images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "My Expenses Book: scan a receipt, keep the record, not the paper." }]` only if the build does not already emit `og:image` from the file convention (check `out/index.html` for `og:image` first).

- [ ] **Step 5: `scripts/prepare-screenshots.mjs`.** For each `ShotId` name (`home-slip`, `capture`, `review`, `receipt-detail`, `statistics`, `tip-jar`): if `screenshots-src/<name>.png` exists, check it is exactly 1320×2868 (otherwise print `<name>.png: expected 1320x2868, got WxH` and exit 1), then write `public/screenshots/<name>.webp` resized to 780×1695, WebP quality 82. Print one line per file: `wrote` or `missing`. Exit 0 when files are only missing. Add `"screenshots": "node scripts/prepare-screenshots.mjs"`.

- [ ] **Step 6: `screenshots-src/README.md`.** Copy the "Screenshots" table and capture rules from the spec, and add: "After `npm run screenshots`, set `ready: true` for each written file in `src/content/screenshots.ts`."

- [ ] **Step 7: Run `npm run screenshots`.** Expected: six `missing` lines, exit 0. Run the full check; `out/404.html` contains "This page is not in the book". Commit as `feat(web): 404 page, brand images, screenshot script`.

---

### Task 11: Checks on the built site (links, third parties, contrast, placeholders)

**Files:**
- Create: `scripts/check-out.mjs`
- Modify: `package.json` (scripts `check`, `check:launch`)

**Interfaces:**
- Consumes: `out/` from `npm run build`; `src/**/*.module.css`, `src/**/*.tsx`.
- Produces: `npm run check` (build, then checks 1 to 4), `npm run check:launch` (the same plus check 5).

- [ ] **Step 1: Write `scripts/check-out.mjs`** (Node ESM, no dependency; parse HTML with regular expressions over `out/**/*.html`). It collects failures, prints each as `FAIL <file>: <reason>`, and exits 1 if there are any, else prints `OK <n> pages checked`. Checks:

  1. **Internal links resolve.** Every `href="/…"` on an `<a>` or `<link>` (ignore the `#fragment`) must exist in `out/` as that path, that path + `.html`, or that path + `/index.html`. For `href="/page#id"` and `href="#id"`, the target file must contain `id="<id>"`.
  2. **No third-party resource.** No `src=`, `srcset=`, `<link … href=`, `url(` in inline styles, or `@import` in `out/_next/**/*.css` may point at `http://`, `https://` or `//` on a host other than `meb.terhubung.app`. `<a href="https://…">` is allowed (a link is not a request), and so are `<link rel="canonical">` and `<meta>` content values.
  3. **Required pages exist.** `out/index.html`, `out/privacy.html`, `out/terms.html`, `out/404.html`, `out/robots.txt`, `out/sitemap.xml`.
  4. **No raw colour outside the token files.** No `#RGB`/`#RRGGBB` and no `rgb(`/`hsl(` in `src/**/*.module.css` or `src/components/**/*.tsx` or `src/app/**/page.tsx`. (`globals.css`, `tokens.ts` and `layout.tsx` are exempt. Do not treat `href="#…"` fragments as colours.)
  5. **Launch only (`--launch` flag).** No `data-placeholder=` in any HTML; every `/screenshots/*.webp` referenced exists in `out/`; no "Coming soon" text in `out/index.html`.

  Check 2 also runs without `--launch` on screenshot files: any `/screenshots/…` URL in the HTML must exist in `out/` (this catches `ready: true` with a missing file).

- [ ] **Step 2: Add scripts.** `"check": "npm run lint && npm run typecheck && npm test && npm run build && node scripts/check-out.mjs"`, `"check:launch": "npm run check && node scripts/check-out.mjs --launch"`.

- [ ] **Step 3: Prove each check fails when it should.** One at a time, make the change, run `npm run check`, see the named failure, then revert:
  - add `<a href="/nope">x</a>` to `page.tsx`: expect `FAIL … /nope does not resolve`;
  - set `ready: true` for `review` in `screenshots.ts`: expect `FAIL … /screenshots/review.webp is missing`;
  - add `color: #ff0000;` to `TipJar.module.css`: expect `FAIL … raw colour`.

- [ ] **Step 4: Run `npm run check`. Expected: `OK 4 pages checked` (index, privacy, terms, 404; count any extra Next output pages too and adjust the wording, not the checks). Run `npm run check:launch`. Expected: FAIL, listing six placeholders and "Coming soon". That is correct until launch.**

- [ ] **Step 5: Commit** as `test(web): static output checks for links, third parties and colours`.

Contrast: the token pairs are already tested in `src/theme/tokens.test.ts`. Check 4 is what keeps that test meaningful, because it stops any colour that is not a token. If a task needed a new text pair, confirm it is in `textPairs`.

---

### Task 12: Vercel configuration and deploy notes

**Files:**
- Create: `apps/web/vercel.json`, `apps/web/DEPLOY.md`

**Interfaces:**
- Consumes: nothing.
- Produces: response headers on Vercel; instructions for the owner. Do not run `vercel`, do not deploy, do not push.

- [ ] **Step 1: `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'" },
        { "key": "Referrer-Policy", "value": "no-referrer" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), interest-cohort=()" }
      ]
    }
  ]
}
```

`'unsafe-inline'` for scripts is needed because the static export inlines its hydration data; the policy still blocks every other origin, which is the point.

- [ ] **Step 2: `DEPLOY.md`** with these sections, in plain steps:

  1. **Create the project.** Vercel dashboard > Add New > Project > import the Git repository. Set **Root Directory** to `apps/web`. Framework preset: Next.js. Build command, output directory and install command: leave the defaults (`next build`; the static export in `out/` is detected). Node.js version: 24.x or the newest offered. No environment variables.
  2. **Keep it quiet.** Do not enable Web Analytics or Speed Insights (both add a script and requests). Do not add any integration. Leave "Vercel Toolbar" off for production.
  3. **Production branch.** Set it to `main`. Optional: Settings > Git > Ignored Build Step = `git diff --quiet HEAD^ HEAD -- .` so that commits outside `apps/web` do not rebuild.
  4. **Add the domain.** Project > Settings > Domains > add `meb.terhubung.app`.
  5. **DNS.** At the DNS provider for `terhubung.app`, add one record: type `CNAME`, name (host) `meb`, value `cname.vercel-dns.com.`, TTL 3600 (or automatic). If Vercel's Domains page shows a project-specific target instead (for example `xxxx.vercel-dns-017.com`), use the value Vercel shows. If the DNS is on Cloudflare, set the record to "DNS only" (grey cloud). Do not add an A record for `meb`. Wait until the Domains page shows "Valid Configuration"; Vercel then issues the HTTPS certificate by itself.
  6. **Verify after the first deploy.** `curl -sI https://meb.terhubung.app/privacy` returns `200`, a `content-security-policy` header and no `set-cookie` header. Open the three pages; in the browser's network panel every request goes to `meb.terhubung.app`.
  7. **Launch checklist.** (a) Terms reviewed (they are a draft). (b) Screenshots captured, `npm run screenshots`, `ready: true`. (c) `STORE_LINKS` filled in `src/config/site.ts`. (d) `npm run check:launch` passes. (e) In the app, set `PRIVACY_POLICY_URL` in `apps/mobile/src/about/links.ts` to `https://meb.terhubung.app/privacy` and use the same URL in App Store Connect and Play Console (mobile work, not part of this plan). `site/privacy/index.html` is superseded and stays in the repo.

- [ ] **Step 3: Run the full check and commit** as `docs(web): Vercel configuration and deploy notes`.

---

### Task 13: Visual and accessibility review (lead or owner, not the cheaper model)

**Files:** fixes only, in the files of Tasks 2 to 9.

- [ ] **Step 1:** `npm run build && npm run start`. View `/`, `/privacy`, `/terms` and a 404 at 320, 390, 768 and 1280px wide, in light and dark. Look for: horizontal scroll, the hero phone covering text, the tilted receipt clipping at 320px, long strings overflowing, uneven section spacing.
- [ ] **Step 2:** Keyboard: Tab from the top. The skip link appears first; every link shows a visible outline (yellow on the slip, green elsewhere); disabled badges are skipped.
- [ ] **Step 3:** Turn on "reduce motion" in the OS and reload: the hero phone does not animate.
- [ ] **Step 4:** Zoom to 200% at 1280px: no content is cut off.
- [ ] **Step 5:** Compare the page with the spec's "Review against the brief" list; remove anything that crept in (cards, icons, extra labels, hover effects).
- [ ] **Step 6:** `npm run check` passes; commit fixes as `fix(web): review pass`.

## Handoff notes

- Tasks 2 to 12 are written for a cheaper model: each has exact files, props, CSS values and tests. Do them in order; Tasks 5 to 8 depend on `Section` and `PhoneShot`.
- Task 13 needs judgement about how the page looks.
- The Terms are a **draft; the owner should have them reviewed**. Do not change legal wording while implementing; report any doubt instead.
- Screenshots are captured by someone else (another agent has the simulator). Do not start or drive a simulator.
