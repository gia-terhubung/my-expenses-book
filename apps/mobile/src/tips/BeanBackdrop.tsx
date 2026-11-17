import { View } from "react-native";
import Animated, { useReducedMotion, type CSSAnimationKeyframes } from "react-native-reanimated";

import { useTheme } from "@/theme/ThemeProvider";

import { TIP_ART } from "./palette";

type Bean = {
  size: number; // long axis
  top: `${number}%`;
  left: `${number}%`;
  turn: number; // degrees
  drift?: { x: number; y: number; spin: number; seconds: number };
};

/** Scattered by hand, denser at the edges so few beans sit under the text column. Three drift. */
const BEANS: Bean[] = [
  { size: 46, top: "3%", left: "78%", turn: 24, drift: { x: -10, y: 12, spin: 8, seconds: 23 } },
  { size: 30, top: "9%", left: "52%", turn: -38 },
  { size: 36, top: "17%", left: "-3%", turn: 62 },
  { size: 26, top: "27%", left: "88%", turn: -12 },
  { size: 40, top: "36%", left: "30%", turn: 140 },
  { size: 28, top: "45%", left: "67%", turn: 75, drift: { x: 12, y: -8, spin: -10, seconds: 29 } },
  { size: 44, top: "55%", left: "-5%", turn: -50 },
  { size: 32, top: "63%", left: "44%", turn: 18 },
  { size: 38, top: "71%", left: "84%", turn: 105 },
  { size: 26, top: "79%", left: "18%", turn: -72, drift: { x: 9, y: 11, spin: 12, seconds: 31 } },
  { size: 48, top: "88%", left: "58%", turn: 33 },
  { size: 30, top: "95%", left: "2%", turn: -20 },
];

const BEAN_RATIO = 0.68; // short axis / long axis

function keyframes(turn: number, d: NonNullable<Bean["drift"]>): CSSAnimationKeyframes {
  return {
    from: { transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: `${turn}deg` }, { scaleX: BEAN_RATIO }] },
    to: { transform: [{ translateX: d.x }, { translateY: d.y }, { rotate: `${turn + d.spin}deg` }, { scaleX: BEAN_RATIO }] },
  };
}

/**
 * Decorative coffee beans. Each is a circle squeezed into an oval, with a curved seam: the left edge of
 * a second circle in the background colour, clipped by the bean. Twelve childless-cheap views; only three
 * animate (transform only, Reanimated CSS animations on the UI thread), paused while the screen is not
 * focused and never started under the OS "reduce motion" setting.
 */
export function BeanBackdrop({ paused }: { paused: boolean }) {
  const { colors, scheme } = useTheme();
  const art = TIP_ART[scheme];
  const reduced = useReducedMotion();
  return (
    <View
      testID="tip-backdrop"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden" }}
    >
      {BEANS.map((b, i) => (
        <Animated.View
          key={i}
          testID={`tip-bean-${i}`}
          style={[
            {
              position: "absolute",
              top: b.top,
              left: b.left,
              width: b.size,
              height: b.size,
              borderRadius: b.size / 2,
              overflow: "hidden",
              backgroundColor: art.bean,
              transform: [{ rotate: `${b.turn}deg` }, { scaleX: BEAN_RATIO }],
            },
            b.drift && !reduced
              ? {
                  animationName: keyframes(b.turn, b.drift),
                  animationDuration: `${b.drift.seconds}s`,
                  animationTimingFunction: "ease-in-out",
                  animationIterationCount: "infinite",
                  animationDirection: "alternate",
                  animationPlayState: paused ? "paused" : "running",
                }
              : null,
          ]}
        >
          <View
            testID="tip-bean-seam"
            style={{
              position: "absolute",
              top: -b.size * 0.1,
              left: b.size * 0.42,
              width: b.size * 1.2,
              height: b.size * 1.2,
              borderRadius: b.size * 0.6,
              borderLeftWidth: Math.max(3, b.size * 0.09),
              borderColor: "transparent",
              borderLeftColor: colors.background,
            }}
          />
        </Animated.View>
      ))}
    </View>
  );
}
