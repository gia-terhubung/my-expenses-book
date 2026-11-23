import { clampOffset, clampScale, fitSize, inlineCap, maxOffset, panStep, pinchStep, zoomAround } from "./zoomMath";

const vp = { width: 400, height: 800 };

describe("zoomMath", () => {
  it("fitSize contains a tall receipt in the viewport", () => {
    const s = fitSize({ width: 1000, height: 3000 }, vp);
    expect(s.width).toBeCloseTo(266.67, 1);
    expect(s.height).toBeCloseTo(800, 5);
  });

  it("fitSize falls back to the viewport for an unknown (zero) content size", () => {
    expect(fitSize({ width: 0, height: 0 }, vp)).toEqual({ width: 400, height: 800 });
  });

  it("clampScale keeps 1..5", () => {
    expect(clampScale(0.5)).toBe(1);
    expect(clampScale(7)).toBe(5);
    expect(clampScale(2.5)).toBe(2.5);
  });

  it("maxOffset is zero at 1x and half the overflow when zoomed", () => {
    expect(maxOffset(vp, vp, 1)).toEqual({ x: 0, y: 0 });
    expect(maxOffset(vp, vp, 2)).toEqual({ x: 200, y: 400 });
  });

  it("maxOffset is zero on an axis the zoomed image still fits", () => {
    expect(maxOffset({ width: 100, height: 800 }, vp, 2)).toEqual({ x: 0, y: 400 });
  });

  it("clampOffset keeps the image on screen", () => {
    expect(clampOffset(999, -999, vp, vp, 2)).toEqual({ x: 200, y: -400 });
    expect(clampOffset(50, 50, vp, vp, 1)).toEqual({ x: 0, y: 0 });
  });

  it("zoomAround the centre keeps the offset", () => {
    expect(zoomAround(200, 400, vp, { scale: 1, x: 0, y: 0 }, 2)).toEqual({ x: 0, y: 0 });
  });

  it("zoomAround keeps the focal point under the finger", () => {
    expect(zoomAround(300, 400, vp, { scale: 1, x: 0, y: 0 }, 2)).toEqual({ x: -100, y: 0 });
  });

  it("inlineCap is 55% of the window height, at least 240", () => {
    expect(inlineCap(466)).toBe(256);
    expect(inlineCap(300)).toBe(240);
    expect(inlineCap(951)).toBe(523);
  });
});

describe("pinchStep", () => {
  const vp400 = { width: 400, height: 800 };
  const start = { scale: 2, x: 0, y: 0, focalX: 200, focalY: 400, eScale: 1 };

  it("moving the pinch centre at the same scale moves the photo with the fingers", () => {
    // Review finding: with the start offset but the current focal point, the photo slid against the fingers.
    expect(pinchStep(start, 250, 400, 1, vp400, vp400)).toEqual({ scale: 2, x: 50, y: 0 });
  });

  it("keeps the start focal point under the fingers while scaling", () => {
    const s = { ...start, scale: 1, focalX: 300 };
    expect(pinchStep(s, 300, 400, 2, vp400, vp400)).toEqual({ scale: 2, x: -100, y: 0 });
  });

  it("measures scale from activation, so a threshold-delayed start does not jump", () => {
    const s = { ...start, scale: 1, eScale: 1.05 };
    expect(pinchStep(s, 200, 400, 1.05, vp400, vp400).scale).toBe(1);
  });

  it("may undershoot to 0.8 while pinching, offsets clamped as at 1x", () => {
    const s = { ...start, scale: 1 };
    expect(pinchStep(s, 200, 400, 0.5, vp400, vp400)).toEqual({ scale: 0.8, x: 0, y: 0 });
  });

  it("never passes 5x", () => {
    expect(pinchStep(start, 200, 400, 10, vp400, vp400).scale).toBe(5);
  });
});

describe("panStep", () => {
  const vp400 = { width: 400, height: 800 };

  it("moves the zoomed photo by the finger delta, clamped", () => {
    expect(panStep(false, 2, 0, 0, 30, -500, vp400, vp400)).toEqual({ x: 30, y: -400 });
  });

  it("does nothing at 1x", () => {
    expect(panStep(false, 1, 0, 0, 30, 30, vp400, vp400)).toBeNull();
  });

  it("yields to an active pinch, which already carries the finger movement", () => {
    // Review finding: pinch and pan both wrote the offset each frame and fought.
    expect(panStep(true, 2, 0, 0, 30, 30, vp400, vp400)).toBeNull();
  });
});
