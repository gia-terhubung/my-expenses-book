import { FONTS } from "./fonts";

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 12, lg: 20, pill: 999, control: 14, sheet: 26 } as const;

/** Sizes are scaled by the OS font scale automatically when used in <Text>. */
export const type = {
  caption: { fontSize: 12, lineHeight: 16 },
  body: { fontSize: 16, lineHeight: 22 },
  title: { fontFamily: FONTS.bold, fontSize: 20, lineHeight: 26 },
  headline: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  display: { fontFamily: FONTS.extraBold, fontSize: 28, lineHeight: 34 },
  label: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  money: { fontVariant: ["tabular-nums"] },
} as const;

export const state = { disabledOpacity: 0.4, pressedOpacity: 0.6 } as const;

export const size = { touch: 48, row: 56, fab: 60, plus: 56, capsule: 60 } as const;

export const lightColors = {
  background: "#F2F5F1",
  surface: "#FFFFFF",
  surfacePressed: "#E9EEEA",
  text: "#16201C",
  textMuted: "#56635D",
  border: "#DCE5DF",
  primary: "#1F5C4C",
  primaryPressed: "#174639",
  onPrimary: "#FFFFFF",
  tonal: "#E3EEE8",
  tonalPressed: "#D3E4DA",
  danger: "#B3261E",
  tonalDanger: "#FBE9E7",
  warning: "#6B4E00",
  brassFill: "#FFF3C4",
  brassRing: "#FFD84A",
  highlight: "#FFD84A",
  onHighlight: "#16201C",
  slip: "#1F5C4C",
  slipText: "#FFFFFF",
  slipMuted: "#BFD9CF",
  bar: "#6F9E8E",
  // Outline buttons: 3:1 against the page and the surface (WCAG 1.4.11, UI boundaries).
  outline: "#5E8F7F",
  outlineDanger: "#D06A62",
} as const;

export type ColorTokens = { [K in keyof typeof lightColors]: string };

export const darkColors: ColorTokens = {
  background: "#0E1513",
  surface: "#17211E",
  surfacePressed: "#1F2A26",
  text: "#EEF3F0",
  textMuted: "#93A39C",
  border: "#26332E",
  primary: "#74C9AE",
  primaryPressed: "#93D7C1",
  onPrimary: "#06241B",
  tonal: "#1E3A32",
  tonalPressed: "#25463C",
  danger: "#F2B8B5",
  tonalDanger: "#3A1F1D",
  warning: "#FFD84A",
  brassFill: "#2B2610",
  brassRing: "#5A4E1C",
  highlight: "#FFD84A",
  onHighlight: "#16201C",
  slip: "#163F34",
  slipText: "#EEF3F0",
  slipMuted: "#BFD9CF",
  bar: "#4A7A6B",
  outline: "#3F7F6C",
  outlineDanger: "#B85A52",
};

export const elevation = {
  light: {
    raised: "0 10px 22px -8px rgba(31,92,76,0.55), 0 2px 4px rgba(31,92,76,0.25)",
    sheet: "0 -12px 32px -12px rgba(22,32,28,0.35)",
  },
  dark: {
    raised: "0 10px 22px -8px rgba(0,0,0,0.8), 0 0 0 1px rgba(116,201,174,0.25)",
    sheet: "0 -12px 32px -8px rgba(0,0,0,0.8)",
  },
} as const;

export type Theme = {
  scheme: "light" | "dark";
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof type;
  elevation: { raised: string; sheet: string };
  state: typeof state;
  size: typeof size;
};

export const tokens: { light: Theme; dark: Theme } = {
  light: { scheme: "light", colors: lightColors, spacing, radius, type, elevation: elevation.light, state, size },
  dark: { scheme: "dark", colors: darkColors, spacing, radius, type, elevation: elevation.dark, state, size },
};
