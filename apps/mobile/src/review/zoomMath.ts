/**
 * Zoom geometry for the full-screen receipt photo. The image is drawn contain-fitted and centred in
 * the viewport, then transformed by `scale` around its centre and translated by an offset (x, y).
 * All functions are worklets so gesture callbacks can call them on the UI thread.
 */
export type Size = { width: number; height: number };

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
export const DOUBLE_TAP_SCALE = 2.5;

/** Contain fit of `content` in `viewport`; the viewport itself when the content size is unknown. */
export function fitSize(content: Size, viewport: Size): Size {
  "worklet";
  if (content.width <= 0 || content.height <= 0) return { width: viewport.width, height: viewport.height };
  const k = Math.min(viewport.width / content.width, viewport.height / content.height);
  return { width: content.width * k, height: content.height * k };
}

export function clampScale(s: number): number {
  "worklet";
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/** Largest offset on each axis that keeps the scaled image's edge at or beyond the viewport edge. */
export function maxOffset(fitted: Size, viewport: Size, scale: number): { x: number; y: number } {
  "worklet";
  return {
    x: Math.max(0, (fitted.width * scale - viewport.width) / 2),
    y: Math.max(0, (fitted.height * scale - viewport.height) / 2),
  };
}

export function clampOffset(x: number, y: number, fitted: Size, viewport: Size, scale: number): { x: number; y: number } {
  "worklet";
  const m = maxOffset(fitted, viewport, scale);
  // `+ 0` turns -0 into 0 so callers (and tests) never see a negative zero.
  return { x: Math.min(m.x, Math.max(-m.x, x)) + 0, y: Math.min(m.y, Math.max(-m.y, y)) + 0 };
}

/**
 * Offset after zooming from `from` to `toScale` so the image point under the focal point (viewport
 * coordinates, origin top-left) stays under it. Not clamped.
 */
export function zoomAround(
  focalX: number,
  focalY: number,
  viewport: Size,
  from: { scale: number; x: number; y: number },
  toScale: number,
): { x: number; y: number } {
  "worklet";
  const fx = focalX - viewport.width / 2;
  const fy = focalY - viewport.height / 2;
  const k = toScale / from.scale;
  return { x: fx - (fx - from.x) * k + 0, y: fy - (fy - from.y) * k + 0 };
}

/** Inline photo height cap: 55% of the window height, never below 240. */
export function inlineCap(windowHeight: number): number {
  "worklet";
  return Math.max(240, Math.round(windowHeight * 0.55));
}

/** A pinch may undershoot to this while the fingers are down; it springs back to 1x on release. */
export const PINCH_FLOOR = 0.8;

/** State captured when a pinch activates: the transform then, where the fingers were, and the event's scale then. */
export type PinchStart = { scale: number; x: number; y: number; focalX: number; focalY: number; eScale: number };

/**
 * One pinch frame. The image point that was under the fingers at activation stays under the
 * fingers now, so moving the pinch centre moves the photo with it. Scale is measured from
 * activation (`eScale / start.eScale`), so a threshold-delayed activation does not jump.
 */
export function pinchStep(
  start: PinchStart,
  focalX: number,
  focalY: number,
  eScale: number,
  viewport: Size,
  fitted: Size,
): { scale: number; x: number; y: number } {
  "worklet";
  const s = Math.min(MAX_SCALE, Math.max(PINCH_FLOOR, start.scale * (eScale / start.eScale)));
  const k = s / start.scale;
  const fsx = start.focalX - viewport.width / 2;
  const fsy = start.focalY - viewport.height / 2;
  const fcx = focalX - viewport.width / 2;
  const fcy = focalY - viewport.height / 2;
  const o = clampOffset(fcx - (fsx - start.x) * k, fcy - (fsy - start.y) * k, fitted, viewport, Math.max(1, s));
  return { scale: s, x: o.x, y: o.y };
}

/** One pan frame: the new offset, or null when there is nothing to do (1x, or a pinch owns the frame). */
export function panStep(
  pinching: boolean,
  scale: number,
  x: number,
  y: number,
  dx: number,
  dy: number,
  viewport: Size,
  fitted: Size,
): { x: number; y: number } | null {
  "worklet";
  if (pinching || scale <= 1) return null;
  return clampOffset(x + dx, y + dy, fitted, viewport, scale);
}
