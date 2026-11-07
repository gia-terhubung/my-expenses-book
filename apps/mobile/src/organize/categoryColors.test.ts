import { darkColors, lightColors } from "@/theme/tokens";

import { CATEGORY_COLORS } from "./categoryColors";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("CATEGORY_COLORS", () => {
  it("has 8 distinct hex swatches", () => {
    expect(CATEGORY_COLORS).toHaveLength(8);
    expect(new Set(CATEGORY_COLORS).size).toBe(8);
    for (const c of CATEGORY_COLORS) expect(c).toMatch(/^#[0-9A-F]{6}$/);
  });

  it.each([...CATEGORY_COLORS])("%s reads on light and dark surfaces", (c) => {
    for (const bg of [lightColors.background, lightColors.surface, darkColors.background, darkColors.surface]) {
      expect(contrast(c, bg)).toBeGreaterThanOrEqual(3);
    }
  });
});
