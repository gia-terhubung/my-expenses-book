# Receipt Photo Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Larger, higher inline receipt photo and a full-screen viewer that zooms on iOS and Android.

**Architecture:** Pure zoom math in `src/review/zoomMath.ts` (node-tested). A `ZoomableImage` component
drives it with react-native-gesture-handler v3 hooks and Reanimated shared values. `PageViewer` uses
`ZoomableImage` in its full-screen modal and gets a capped, top-cropped inline mode. `ReceiptDetail`
moves the viewer under its action row.

**Tech Stack:** Expo SDK 58, React Native, react-native-gesture-handler 3.3 (hook API:
`usePinchGesture`, `usePanGesture`, `useTapGesture`, `useSimultaneousGestures`,
`useExclusiveGestures`, `GestureDetector`), react-native-reanimated 4.7, expo-image, Jest (node +
jest-expo projects).

**Spec:** `docs/superpowers/specs/2026-11-23-receipt-photo-viewer-design.md`

## Global Constraints

- No new dependencies.
- Inline height cap: `max(240, round(windowHeight * 0.55))`.
- Double-tap zoom: 2.5x at the tapped point; double-tap when zoomed returns to 1x.
- Pinch range 1x to 5x; below 1x on release springs back to 1x.
- Pan clamped so the fitted image never leaves the viewport edge.
- Window size change while open: zoom resets, viewer stays open.
- Reduced motion: zoom changes jump, no animation.
- Copy in en, id, es, pt-BR; sentence case.

## Review Focus

- Photo with unknown size (`width`/`height` null): falls back to 3:4 aspect, nothing divides by zero.
- Short window (Duo sideways 466 tall): inline cap 256, never taller than the window.
- Pan at 1x: no translation (image cannot be dragged around when not zoomed).
- Zoom out after pan near an edge: translation re-clamped, no blank strip.
- Photo failed to decrypt (`"error"`): inline shows the existing unavailable text, no expand icon.

---

### Task 1: Zoom math

**Files:**
- Create: `apps/mobile/src/review/zoomMath.ts`
- Test: `apps/mobile/src/review/zoomMath.test.ts`

**Interfaces:**
- Produces:
  - `type Size = { width: number; height: number }`
  - `MIN_SCALE = 1`, `MAX_SCALE = 5`, `DOUBLE_TAP_SCALE = 2.5`
  - `fitSize(content: Size, viewport: Size): Size` (contain fit)
  - `clampScale(s: number): number`
  - `maxOffset(fitted: Size, viewport: Size, scale: number): { x: number; y: number }`
  - `clampOffset(x: number, y: number, fitted: Size, viewport: Size, scale: number): { x: number; y: number }`
  - `zoomAround(focalX: number, focalY: number, viewport: Size, from: { scale: number; x: number; y: number }, toScale: number): { x: number; y: number }`
    (focal in viewport coordinates, origin top-left; offsets are translation of the centred image)
  - `inlineCap(windowHeight: number): number`
  All functions are `'worklet'`.

- [ ] **Step 1: Failing tests** — `fitSize({1000,3000},{400,800})` = `{266.67,800}` (toBeCloseTo);
  `clampScale(0.5)=1`, `clampScale(7)=5`; `maxOffset` at scale 1 = `{0,0}`; at scale 2 with fitted
  `{400,800}` viewport `{400,800}` = `{200,400}`; `clampOffset(999,-999,…)` = `{200,-400}`;
  `zoomAround(focal at centre)` keeps offset `{0,0}`; `zoomAround(300,400, vp {400,800}, {1,0,0}, 2)` =
  `{x:-100,y:0}`; `inlineCap(466)=256`, `inlineCap(300)=240`, `inlineCap(951)=523`.
- [ ] **Step 2:** `bunx jest src/review/zoomMath.test.ts` fails (module missing).
- [ ] **Step 3:** Implement. `zoomAround`: `f = focal - viewport/2`; `t1 = f - (f - t0) * (s1 / s0)`.
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5:** Commit `feat(photo): zoom math for the receipt viewer`.

### Task 2: ZoomableImage

**Files:**
- Create: `apps/mobile/src/review/ZoomableImage.tsx`
- Test: `apps/mobile/src/review/ZoomableImage.test.tsx`
- Modify: `apps/mobile/src/i18n/locales/{en,id,es,pt-BR}.json` (`review.zoomIn`, `review.zoomOut`)
- Modify: `apps/mobile/test/reanimatedMock.js` if the component needs more Reanimated stand-ins

**Interfaces:**
- Consumes: Task 1.
- Produces: `ZoomableImage({ uri, contentSize }: { uri: string; contentSize: Size }): JSX.Element`.
  Fills its parent. Measures viewport with `onLayout`; zoom resets whenever the viewport size changes.

- [ ] **Step 1: Failing tests** (RNGH jest setup `react-native-gesture-handler/jestSetup`):
  renders an element with `accessibilityActions` named `zoomIn` and `zoomOut` with translated labels
  ("Zoom in", "Zoom out"); renders the expo-image with `contentFit="contain"`.
- [ ] **Step 2:** Run, see FAIL.
- [ ] **Step 3:** Implement. Gestures: pinch (focal zoom, clamp scale 0.8..5 live, spring to clamp on
  end), pan (`minPointers: 1`, enabled only when scale > 1 via shared value; clamp live), double tap
  (`numberOfTaps: 2`): toggles 1x / 2.5x around tap point. Compose: `useExclusiveGestures(doubleTap,
  useSimultaneousGestures(pinch, pan))`. Animate with `withTiming(…,{duration:220})` unless
  `useReducedMotion()`. Accessibility actions step scale by 1.5x around centre, clamped.
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5:** Commit `feat(photo): zoomable full-screen image on iOS and Android`.

### Task 3: PageViewer inline cap + full screen

**Files:**
- Modify: `apps/mobile/src/review/PageViewer.tsx`
- Test: `apps/mobile/src/review/PageViewer.test.tsx` (create)

**Interfaces:**
- Consumes: `ZoomableImage`, `inlineCap`.
- Produces: unchanged `PageViewer({ pages, fill })`.

- [ ] **Step 1: Failing tests:** inline (non-fill) page style has `width: "100%"` and `maxHeight`
  = `inlineCap(windowHeight)`; when the page aspect makes the full-width height exceed the cap, image
  has `contentFit="cover"` and `contentPosition="top"` and a fade + expand icon (`testID
  "photo-expand-hint"`); a short page uses `contain` and still shows the icon; `"error"` page shows
  "photo unavailable" text and no icon; tapping opens the modal containing `ZoomableImage`.
- [ ] **Step 2:** Run, FAIL.
- [ ] **Step 3:** Implement. Inline width from `onLayout` of the container; height = `min(width /
  aspect, cap)`; cropped when `width / aspect > cap`. Fade: an absolutely positioned bottom strip using
  the surface colour at increasing opacity (stacked Views, no gradient dependency). Icon: Ionicons
  `expand` 18 pt in a 32 pt circle, bottom-right, surface background. Full screen modal content wrapped
  in `GestureHandlerRootView` (RN Modal is a separate root) and renders `ZoomableImage`.
  `fill` mode unchanged except the icon.
- [ ] **Step 4:** PageViewer + ReceiptFormScreen tests pass.
- [ ] **Step 5:** Commit `feat(photo): larger inline receipt photo with expand hint`.

### Task 4: Photo under the actions on the receipt screen

**Files:**
- Modify: `apps/mobile/src/receipts/ReceiptDetail.tsx:173-187`
- Test: `apps/mobile/src/receipts/ReceiptDetail.test.tsx`

- [ ] **Step 1: Failing test:** with one page seeded, the photo button appears after
  `receipt-detail-actions` and before the category field in render order.
- [ ] **Step 2:** FAIL. **Step 3:** move `<PageViewer>` directly after the actions row.
- [ ] **Step 4:** PASS. **Step 5:** Commit `feat(receipts): receipt photo sits under the actions`.

### Task 5: Verify

- [ ] `bunx tsc --noEmit`, `bunx expo lint`, `bunx jest` all clean.
- [ ] iPhone Duo simulator: closed portrait, closed sideways, open portrait, open landscape (split
  detail pane): inline photo size, crop + hint, full screen double-tap, pinch, pan, Done, rotate while
  open. Screenshots in scratchpad.
- [ ] Fix any gap found; commit; push to main.
