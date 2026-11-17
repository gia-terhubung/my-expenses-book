import { View, type ViewStyle } from "react-native";
import Animated, { cubicBezier } from "react-native-reanimated";

import type { TipId } from "@/payments/types";
import { useTheme } from "@/theme/ThemeProvider";

import { TIP_ART, type TipArt } from "./palette";

const LINE = 2;
const LIFT_EASE = cubicBezier(0.23, 1, 0.32, 1);

type Shape = {
  width: number;
  height: number;
  bottomRadius: number;
  pour: number; // liquid height as a share of the inside of the cup
  liquid: keyof TipArt;
  handle: { width: number; height: number; top: number };
  saucer: number; // width; 0 = none (a mug stands on the counter)
};

/** Three silhouettes, so the cups differ by shape and fill, not by label alone. */
const SHAPES: Record<TipId, Shape> = {
  // Demitasse: small and low, poured less than half.
  tip_coffee_small: { width: 34, height: 26, bottomRadius: 13, pour: 0.4, liquid: "espresso", handle: { width: 10, height: 12, top: 4 }, saucer: 54 },
  // Mug: tall, nearly straight sides, filled to just under the rim.
  tip_coffee_standard: { width: 44, height: 50, bottomRadius: 8, pour: 0.9, liquid: "black", handle: { width: 14, height: 24, top: 10 }, saucer: 0 },
  // Cappuccino cup: wide bowl, full, foam on top.
  tip_coffee_generous: { width: 58, height: 36, bottomRadius: 26, pour: 1, liquid: "milky", handle: { width: 13, height: 16, top: 5 }, saucer: 78 },
};

export const CUP_STAGE_HEIGHT = 78;

/** A cup drawn with plain Views. Decorative: the tier's button carries the name and price. */
export function Cup({ id, lifted, still }: { id: TipId; lifted: boolean; still: boolean }) {
  const { scheme } = useTheme();
  const art = TIP_ART[scheme];
  const s = SHAPES[id];
  const inside = s.height - LINE * 2;
  const liquidHeight = Math.round(inside * s.pour);
  const foamWidth = s.width - 6;
  const dot = (left: number, top: number): ViewStyle => ({ position: "absolute", left, top, width: 3, height: 3, borderRadius: 1.5, backgroundColor: art.cocoa });

  return (
    <Animated.View
      testID={`tip-cup-${id}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { alignItems: "center" },
        // Press feedback: the cup is picked up 2 dp. Not under reduce motion.
        still
          ? null
          : {
              transform: [{ translateY: lifted ? -2 : 0 }],
              transitionProperty: "transform",
              transitionDuration: 120,
              transitionTimingFunction: LIFT_EASE,
            },
      ]}
    >
      {id === "tip_coffee_generous" ? (
        <View
          testID="tip-foam"
          style={{
            width: foamWidth,
            height: 15,
            marginBottom: -LINE,
            borderTopLeftRadius: foamWidth / 2,
            borderTopRightRadius: foamWidth / 2,
            borderWidth: LINE,
            borderBottomWidth: 0,
            borderColor: art.line,
            backgroundColor: art.foam,
            zIndex: 1,
          }}
        >
          <View testID="tip-cocoa" style={dot(foamWidth * 0.3, 5)} />
          <View testID="tip-cocoa" style={dot(foamWidth * 0.48, 2)} />
          <View testID="tip-cocoa" style={dot(foamWidth * 0.62, 6)} />
        </View>
      ) : null}

      <View style={{ width: s.width, height: s.height }}>
        <View
          style={{
            position: "absolute",
            left: s.width - LINE,
            top: s.handle.top,
            width: s.handle.width,
            height: s.handle.height,
            borderWidth: LINE,
            borderLeftWidth: 0,
            borderColor: art.line,
            borderTopRightRadius: s.handle.width,
            borderBottomRightRadius: s.handle.width,
          }}
        />
        <View
          testID={`tip-body-${id}`}
          style={{
            width: s.width,
            height: s.height,
            borderWidth: LINE,
            borderColor: art.line,
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
            borderBottomLeftRadius: s.bottomRadius,
            borderBottomRightRadius: s.bottomRadius,
            backgroundColor: art.cup,
            overflow: "hidden",
            justifyContent: "flex-end",
          }}
        >
          <View testID={`tip-liquid-${id}`} style={{ height: liquidHeight, backgroundColor: art[s.liquid] }}>
            {id === "tip_coffee_small" ? <View style={{ height: 2, backgroundColor: art.crema }} /> : null}
          </View>
        </View>
      </View>

      {s.saucer ? <View style={{ width: s.saucer, height: 4, borderRadius: 2, backgroundColor: art.line, marginTop: 1 }} /> : null}
    </Animated.View>
  );
}
