import { guideMode } from "./guideLayout";

const at = (width: number, height: number, right = 0) => guideMode({ width, height, left: 0, right });

describe("guideMode", () => {
  it.each([
    ["phone", 360, 800, 0, "column"],
    ["Duo outer upright", 466, 678, 84, "column"],
    ["Duo outer sideways", 678, 466, 84, "short"],
    ["Duo inner landscape", 951, 669, 84, "split"],
    ["Duo inner portrait", 669, 951, 0, "column"],
    ["Fold inner", 841, 701, 0, "split"],
    ["Fold inner portrait", 701, 841, 0, "column"],
    ["phone landscape (short wins over split)", 874, 402, 0, "short"],
  ])("%s -> %s", (_name, w, h, r, mode) => {
    expect(at(w as number, h as number, r as number)).toBe(mode);
  });
});
