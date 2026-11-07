export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 12, lg: 20, pill: 999 } as const;

/** Sizes are scaled by the OS font scale automatically when used in <Text>. */
export const type = {
  caption: { fontSize: 12, lineHeight: 16 },
  body: { fontSize: 16, lineHeight: 22 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: "600" },
  headline: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
} as const;

export const lightColors = {
  background: "#F7F7F5",
  surface: "#FFFFFF",
  text: "#1C1C1E",
  textMuted: "#6B6B70",
  border: "#E0E0DC",
  primary: "#2F6F5E",
  onPrimary: "#FFFFFF",
  danger: "#B3261E",
  warning: "#9A6700",
} as const;

export type ColorTokens = { [K in keyof typeof lightColors]: string };

export const darkColors: ColorTokens = {
  background: "#101112",
  surface: "#1B1C1E",
  text: "#F2F2F0",
  textMuted: "#9A9AA0",
  border: "#2E2F32",
  primary: "#6CC4A8",
  onPrimary: "#08261D",
  danger: "#F2B8B5",
  warning: "#E3B341",
};

export type Theme = {
  scheme: "light" | "dark";
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  type: typeof type;
};

export const tokens: { light: Theme; dark: Theme } = {
  light: { scheme: "light", colors: lightColors, spacing, radius, type },
  dark: { scheme: "dark", colors: darkColors, spacing, radius, type },
};
