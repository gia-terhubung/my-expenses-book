import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

import { layoutFor, type Layout } from "./layout";
import { useSideInsets } from "./SideSafeArea";

/** The current layout: window size and the root side insets through `layoutFor`. */
export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  const { left, right } = useSideInsets();
  return useMemo(() => layoutFor({ width, height, left, right }), [width, height, left, right]);
}
