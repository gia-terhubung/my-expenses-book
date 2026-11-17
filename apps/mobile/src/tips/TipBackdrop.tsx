import { View } from "react-native";
import Animated, { useReducedMotion, type CSSAnimationKeyframes } from "react-native-reanimated";

import { useTheme } from "@/theme/ThemeProvider";

type Shape = {
  size: number;
  top: `${number}%`;
  left: `${number}%`;
  color: "tonal" | "brassFill";
  seconds: number;
  drift: CSSAnimationKeyframes;
};

const drift = (x: number, y: number, scale: number): CSSAnimationKeyframes => ({
  from: { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] },
  to: { transform: [{ translateX: x }, { translateY: y }, { scale }] },
});

/** Four soft discs, like rings a cup leaves on a table. Different periods so they never move in step. */
const SHAPES: Shape[] = [
  { size: 220, top: "-6%", left: "58%", color: "brassFill", seconds: 19, drift: drift(-22, 26, 1.06) },
  { size: 150, top: "30%", left: "-14%", color: "tonal", seconds: 23, drift: drift(26, -18, 1.08) },
  { size: 260, top: "62%", left: "46%", color: "tonal", seconds: 29, drift: drift(-28, -22, 0.95) },
  { size: 96, top: "84%", left: "8%", color: "brassFill", seconds: 17, drift: drift(18, -24, 1.1) },
];

/**
 * Decorative only. Transform-only Reanimated CSS animations (UI thread, no React renders, no layout),
 * paused while the screen is not focused and not started at all under the OS "reduce motion" setting.
 * The discs use fills that body text is already contrast-tested against (contrast.test.ts).
 */
export function TipBackdrop({ paused }: { paused: boolean }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  return (
    <View
      testID="tip-backdrop"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden" }}
    >
      {SHAPES.map((s, i) => (
        <Animated.View
          key={i}
          testID={`tip-drift-${i}`}
          style={[
            {
              position: "absolute",
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              borderRadius: s.size / 2,
              backgroundColor: colors[s.color],
              opacity: 0.7,
            },
            reduced
              ? null
              : {
                  animationName: s.drift,
                  animationDuration: `${s.seconds}s`,
                  animationTimingFunction: "ease-in-out",
                  animationIterationCount: "infinite",
                  animationDirection: "alternate",
                  animationPlayState: paused ? "paused" : "running",
                },
          ]}
        />
      ))}
    </View>
  );
}
