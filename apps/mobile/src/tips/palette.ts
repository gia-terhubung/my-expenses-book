/**
 * Colours for the tip jar's drawings (cups, beans). Decorative, so they live here and not in the theme
 * tokens. `bean` is the roasted brown (light) / tan (dark) already blended into the screen background
 * at about 10%, kept opaque so text over a bean can be contrast-tested (contrast.test.ts).
 */
export type TipArt = {
  bean: string;
  line: string; // the ink line of every cup, and the counter
  cup: string; // ceramic
  espresso: string;
  crema: string;
  black: string;
  milky: string; // cappuccino under the foam
  foam: string;
  cocoa: string;
};

export const TIP_ART: { light: TipArt; dark: TipArt } = {
  light: {
    bean: "#E3E2DD",
    line: "#16201C",
    cup: "#FFFFFF",
    espresso: "#3E2718",
    crema: "#B98A5A",
    black: "#2E1C12",
    milky: "#A8754F",
    foam: "#FFFFFF",
    cocoa: "#7A4B2A",
  },
  dark: {
    bean: "#1E221D",
    line: "#EEF3F0",
    cup: "#17211E",
    espresso: "#5A3A26",
    crema: "#C99A6A",
    black: "#4A2F20",
    milky: "#B5835C",
    foam: "#EEF3F0",
    cocoa: "#6B452E",
  },
};
