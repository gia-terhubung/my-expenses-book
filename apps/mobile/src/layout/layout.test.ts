import { layoutFor } from "./layout";

const L = (width: number, height: number, left = 0, right = 0) => layoutFor({ width, height, left, right });

describe("layoutFor: iPhone Duo postures (spec section 5)", () => {
  it.each([
    ["closed upright", L(466, 678, 0, 84), { nav: "bar", railWidth: 0, content: 382, paneArea: 382, split: false, listWidth: 0, short: false }],
    ["closed sideways", L(678, 466, 0, 84), { nav: "bar", railWidth: 0, content: 594, paneArea: 594, split: false, listWidth: 0, short: true }],
    ["open portrait", L(669, 951), { nav: "iconRail", railWidth: 72, content: 669, paneArea: 597, split: false, listWidth: 0, short: false }],
    ["open landscape", L(951, 669, 0, 84), { nav: "wideRail", railWidth: 200, content: 867, paneArea: 667, split: true, listWidth: 280, short: false }],
    ["Z Fold inner (approx.)", L(720, 840), { nav: "iconRail", railWidth: 72, content: 720, paneArea: 648, split: true, listWidth: 280, short: false }],
  ])("%s", (_name, got, want) => expect(got).toEqual(want));

  it("open landscape leaves 387 for the detail (divider at x 480)", () => {
    const l = L(951, 669, 0, 84);
    expect(l.railWidth + l.listWidth).toBe(480);
    expect(l.paneArea - l.listWidth).toBe(387);
  });
});

describe("layoutFor: breakpoints on content width", () => {
  it.each([
    [360, "bar", false, 0],
    [599, "bar", false, 0],
    [600, "iconRail", false, 0], // pane 528
    [839, "iconRail", true, 322], // pane 767, round(322.14)
    [840, "wideRail", true, 280], // pane 640, round(268.8) = 269 -> 280
    [1024, "wideRail", true, 346], // pane 824, round(346.08)
    [1600, "wideRail", true, 420], // pane 1400 -> capped
  ])("width %i -> %s, split %s, list %i", (w, nav, split, list) => {
    expect(L(w, 800)).toMatchObject({ nav, split, listWidth: list });
  });

  it("narrowest split detail is 320 (pane 600 at the icon rail)", () => {
    const l = L(672, 800);
    expect(l).toMatchObject({ paneArea: 600, split: true, listWidth: 280 });
    expect(l.paneArea - l.listWidth).toBe(320);
  });

  it("short window is height < 480", () => {
    expect(L(400, 479).short).toBe(true);
    expect(L(400, 480).short).toBe(false);
  });
});

describe("layoutFor: odd inputs (Review Focus 3, 5)", () => {
  it("fractional dp just under 600 is the bar", () => expect(L(599.5, 800).nav).toBe("bar"));
  it("a 0 x 0 first frame is a bar with zero widths and no NaN", () =>
    expect(L(0, 0)).toEqual({ nav: "bar", railWidth: 0, content: 0, paneArea: 0, split: false, listWidth: 0, short: true }));
  it("insets wider than the window never give negative widths", () =>
    expect(L(100, 800, 84, 84)).toMatchObject({ content: 0, paneArea: 0 }));
  it("left-only inset equals right-only inset", () => expect(L(678, 466, 84, 0)).toEqual(L(678, 466, 0, 84)));
});
