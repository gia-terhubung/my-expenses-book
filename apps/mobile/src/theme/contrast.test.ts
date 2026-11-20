import { TIP_ART } from "@/tips/palette";

import { contrast } from "./contrast";
import { darkColors, lightColors, type ColorTokens } from "./tokens";

const PAIRS: [keyof ColorTokens, keyof ColorTokens, number][] = [
  ["text", "background", 4.5],
  ["text", "surface", 4.5],
  ["textMuted", "background", 4.5],
  ["textMuted", "surface", 4.5],
  ["onPrimary", "primary", 4.5],
  ["danger", "surface", 4.5],
  ["warning", "surface", 4.5],
  // Primary is used for 16px text actions, so it needs body-text contrast, not 3:1.
  ["primary", "surface", 4.5],
  ["primary", "background", 4.5],
  ["text", "surfacePressed", 4.5],
  ["textMuted", "surfacePressed", 4.5],
  ["primary", "surfacePressed", 4.5],
  ["danger", "surfacePressed", 4.5],
  ["text", "tonal", 4.5],
  ["textMuted", "tonal", 4.5],
  ["primary", "tonal", 4.5],
  ["primary", "tonalPressed", 4.5],
  ["onPrimary", "primaryPressed", 4.5],
  ["danger", "tonalDanger", 4.5],
  ["warning", "brassFill", 4.5],
  ["slipText", "slip", 4.5],
  ["slipMuted", "slip", 4.5],
  ["onHighlight", "highlight", 4.5],
  // Yellow is a foreground on the green slip (pace line, "see statistics", total bar).
  ["highlight", "slip", 4.5],
];

describe.each([
  ["light", lightColors as ColorTokens],
  ["dark", darkColors],
])("%s theme contrast", (_name, colors) => {
  it.each(PAIRS)("%s on %s ≥ %s", (fg, bg, min) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(min);
  });
});

// Tip jar: faint coffee beans sit behind the heading, intro, notes, prices, footnote and "Try again".
describe.each([
  ["light", lightColors as ColorTokens, TIP_ART.light.bean],
  ["dark", darkColors, TIP_ART.dark.bean],
] as const)("%s tip jar bean backdrop", (_name, colors, bean) => {
  it.each(["text", "textMuted", "primary"] as const)("%s on a bean ≥ 4.5", (fg) => {
    expect(contrast(colors[fg], bean)).toBeGreaterThanOrEqual(4.5);
  });
});

it("contrast() matches WCAG reference values", () => {
  expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  expect(contrast("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
});

it("yellow accent tokens match the spec", () => {
  const pick = (c: ColorTokens) => [c.highlight, c.onHighlight, c.brassFill, c.brassRing, c.warning];
  expect(pick(lightColors)).toEqual(["#FFD84A", "#16201C", "#FFF3C4", "#FFD84A", "#6B4E00"]);
  expect(pick(darkColors)).toEqual(["#FFD84A", "#16201C", "#2B2610", "#5A4E1C", "#FFD84A"]);
});
