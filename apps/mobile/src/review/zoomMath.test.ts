import { clampOffset, clampScale, fitSize, inlineCap, maxOffset, zoomAround } from "./zoomMath";

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
