import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type ColorName,
  contrastRatio,
  cssVarName,
  darkColors,
  lightColors,
  textPairs,
} from "./tokens";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
const darkStart = css.indexOf("@media (prefers-color-scheme: dark)");
const lightCss = css.slice(0, darkStart);
const darkCss = css.slice(darkStart);
const names = Object.keys(lightColors) as ColorName[];

describe("contrast", () => {
  it("reference pair matches the brand spec (yellow on the light slip is 5.63:1)", () => {
    expect(contrastRatio("#FFD84A", "#1F5C4C")).toBeCloseTo(5.63, 1);
  });

  for (const [scheme, colors] of [["light", lightColors], ["dark", darkColors]] as const) {
    it.each(textPairs.map(([fg, bg]) => ({ fg, bg })))(`${scheme}: $fg on $bg is at least 4.5:1`, ({ fg, bg }) => {
      expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("globals.css stays in step with tokens.ts", () => {
  it("has a dark block", () => {
    expect(darkStart).toBeGreaterThan(0);
  });

  it.each(names)("declares %s in light and dark", (name) => {
    expect(lightCss).toContain(`${cssVarName(name)}: ${lightColors[name]};`);
    expect(darkCss).toContain(`${cssVarName(name)}: ${darkColors[name]};`);
  });
});
