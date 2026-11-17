import { windowClassFor } from "./windowClass";

export type Nav = "bar" | "iconRail" | "wideRail";
export type LayoutInput = { width: number; height: number; left: number; right: number };
export type Layout = {
  nav: Nav;
  railWidth: number;
  /** Window width minus the side insets. */
  content: number;
  /** Content minus the rail. */
  paneArea: number;
  split: boolean;
  listWidth: number;
  short: boolean;
};

export const RAIL_WIDTH: Record<Nav, number> = { bar: 0, iconRail: 72, wideRail: 200 };
export const SPLIT_MIN = 600;
export const LIST_MIN = 280;
export const LIST_MAX = 420;
export const LIST_SHARE = 0.42;
export const SHORT_HEIGHT = 480;
export const SHEET_CARD_WIDTH = 480;
export const SHEET_CARD_MIN_CONTENT = 600;

const NAV_BY_CLASS = { compact: "bar", medium: "iconRail", expanded: "wideRail" } as const;

/** Pure layout rules, decided on the real content width (spec section 5). */
export function layoutFor({ width, height, left, right }: LayoutInput): Layout {
  const content = Math.max(0, width - left - right);
  const nav = NAV_BY_CLASS[windowClassFor(content)];
  const railWidth = RAIL_WIDTH[nav];
  const paneArea = Math.max(0, content - railWidth);
  const split = paneArea >= SPLIT_MIN;
  const listWidth = split ? Math.min(LIST_MAX, Math.max(LIST_MIN, Math.round(paneArea * LIST_SHARE))) : 0;
  return { nav, railWidth, content, paneArea, split, listWidth, short: height < SHORT_HEIGHT };
}
