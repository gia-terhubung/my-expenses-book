/**
 * Swatches for custom categories. Mid-tone on purpose: each keeps at least 3:1
 * contrast against both the light and the dark theme backgrounds (see test).
 */
export const CATEGORY_COLORS = [
  "#D9534F",
  "#CF6F00",
  "#2A9456",
  "#1A8F9C",
  "#3D85E0",
  "#8F6BD9",
  "#D13F94",
  "#857354",
] as const;

/** Spoken names for the swatches above, same order (i18n keys under categoryManage.colors). */
export const CATEGORY_COLOR_NAMES = ["red", "orange", "green", "teal", "blue", "purple", "pink", "brown"] as const;
