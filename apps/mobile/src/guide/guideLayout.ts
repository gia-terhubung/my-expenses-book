import { SHORT_HEIGHT, SPLIT_MIN, type LayoutInput } from "@/layout/layout";

/**
 * split: explanation and control side by side, each half the window, gutter on the centre (the
 * fold on the open Duo / Fold). short: one scrolling column with pinned buttons. column: otherwise.
 */
export type GuideMode = "split" | "column" | "short";

export function guideMode({ width, height, left, right }: LayoutInput): GuideMode {
  if (height < SHORT_HEIGHT) return "short";
  if (width - left - right >= SPLIT_MIN && width > height) return "split";
  return "column";
}
