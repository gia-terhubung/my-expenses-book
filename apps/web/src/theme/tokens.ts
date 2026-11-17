/**
 * Ledger slip palette for the website. The values are copied from the app
 * (`apps/mobile/src/theme/tokens.ts`); keep the two in step by hand.
 * `globals.css` declares the same values as `--color-<kebab-name>` custom
 * properties, and `tokens.test.ts` fails if the two drift apart.
 *
 * Yellow rules (brand spec): `highlight` is used only ON the green slip, or as
 * a fill with `onHighlight` ink text. Never yellow text on a light background.
 */
export const lightColors = {
  background: "#F2F5F1",
  surface: "#FFFFFF",
  text: "#16201C",
  textMuted: "#56635D",
  border: "#DCE5DF",
  primary: "#1F5C4C",
  primaryPressed: "#174639",
  onPrimary: "#FFFFFF",
  tonal: "#E3EEE8",
  warning: "#6B4E00",
  brassFill: "#FFF3C4",
  brassRing: "#FFD84A",
  highlight: "#FFD84A",
  onHighlight: "#16201C",
  slip: "#1F5C4C",
  slipText: "#FFFFFF",
  slipMuted: "#BFD9CF",
  /** Web only: the phone frame around screenshots. */
  frame: "#16201C",
} as const;

export type ColorName = keyof typeof lightColors;
export type ColorTokens = Record<ColorName, string>;

export const darkColors: ColorTokens = {
  background: "#0E1513",
  surface: "#17211E",
  text: "#EEF3F0",
  textMuted: "#93A39C",
  border: "#26332E",
  primary: "#74C9AE",
  primaryPressed: "#93D7C1",
  onPrimary: "#06241B",
  tonal: "#1E3A32",
  warning: "#FFD84A",
  brassFill: "#2B2610",
  brassRing: "#5A4E1C",
  highlight: "#FFD84A",
  onHighlight: "#16201C",
  slip: "#163F34",
  slipText: "#EEF3F0",
  slipMuted: "#BFD9CF",
  frame: "#26332E",
};

/**
 * Every [text, background] pair the site may use. All must reach 4.5:1 in
 * both schemes. Add a pair here before using a new combination in CSS.
 */
export const textPairs: ReadonlyArray<readonly [ColorName, ColorName]> = [
  ["text", "background"],
  ["text", "surface"],
  ["text", "tonal"],
  ["textMuted", "background"],
  ["textMuted", "surface"],
  ["primary", "background"],
  ["primary", "surface"],
  ["onPrimary", "primary"],
  ["slipText", "slip"],
  ["slipMuted", "slip"],
  ["highlight", "slip"],
  ["onHighlight", "highlight"],
  ["warning", "brassFill"],
];

/** WCAG 2.x relative luminance of a `#RRGGBB` colour. */
export function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG 2.x contrast ratio between two `#RRGGBB` colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `textMuted` -> `--color-text-muted`. */
export function cssVarName(name: ColorName): string {
  return `--color-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}
