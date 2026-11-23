import { Image } from "expo-image";
import { useCallback, useRef, useState } from "react";
import { type AccessibilityActionEvent, type LayoutChangeEvent, View } from "react-native";
import {
  GestureDetector,
  GestureHandlerRootView,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useTranslation } from "react-i18next";

import {
  clampOffset,
  clampScale,
  DOUBLE_TAP_SCALE,
  fitSize,
  MAX_SCALE,
  type Size,
  zoomAround,
} from "./zoomMath";

/** A pinch may undershoot to this while the fingers are down; it springs back to 1x on release. */
const PINCH_FLOOR = 0.8;
const A11Y_STEP = 1.5;
const DURATION = 220;

/**
 * Full-screen receipt photo with pinch, pan and double-tap zoom on iOS and Android (gesture-handler
 * plus Reanimated; ScrollView zoom is iOS-only). Fills its parent; the zoom resets when the parent's
 * size changes (fold, unfold, rotate). Screen readers get Zoom in / Zoom out actions instead.
 */
export function ZoomableImage({ uri, contentSize }: { uri: string; contentSize: Size }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [viewport, setViewport] = useState<Size | null>(null);
  const [percent, setPercent] = useState(100);
  const lastLayout = useRef<Size | null>(null);

  const vpW = useSharedValue(0);
  const vpH = useSharedValue(0);
  const fitW = useSharedValue(0);
  const fitH = useSharedValue(0);
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const start = useSharedValue({ scale: 1, x: 0, y: 0 });

  const report = useCallback((s: number) => setPercent(Math.round(s * 100)), []);

  /** Moves to (s, x, y): animated unless the person asked for reduced motion. Runs on either thread. */
  const go = (s: number, x: number, y: number) => {
    "worklet";
    if (reduced) {
      scale.set(s);
      tx.set(x);
      ty.set(y);
    } else {
      scale.set(withTiming(s, { duration: DURATION }));
      tx.set(withTiming(x, { duration: DURATION }));
      ty.set(withTiming(y, { duration: DURATION }));
    }
  };

  /** Zoom to `target` keeping the viewport point (fx, fy) still; clamped to the allowed range. */
  const zoomTo = (target: number, fx: number, fy: number) => {
    "worklet";
    const vp = { width: vpW.get(), height: vpH.get() };
    const fit = { width: fitW.get(), height: fitH.get() };
    const s = clampScale(target);
    const raw = zoomAround(fx, fy, vp, { scale: scale.get(), x: tx.get(), y: ty.get() }, s);
    const o = clampOffset(raw.x, raw.y, fit, vp, s);
    go(s, o.x, o.y);
    return s;
  };

  const pinch = usePinchGesture({
    onActivate: () => {
      "worklet";
      start.set({ scale: scale.get(), x: tx.get(), y: ty.get() });
    },
    onUpdate: (e) => {
      "worklet";
      const vp = { width: vpW.get(), height: vpH.get() };
      const fit = { width: fitW.get(), height: fitH.get() };
      const s = Math.min(MAX_SCALE, Math.max(PINCH_FLOOR, start.get().scale * e.scale));
      const raw = zoomAround(e.focalX, e.focalY, vp, start.get(), s);
      const o = clampOffset(raw.x, raw.y, fit, vp, Math.max(1, s));
      scale.set(s);
      tx.set(o.x);
      ty.set(o.y);
    },
    onDeactivate: () => {
      "worklet";
      const vp = { width: vpW.get(), height: vpH.get() };
      const fit = { width: fitW.get(), height: fitH.get() };
      const s = clampScale(scale.get());
      const o = clampOffset(tx.get(), ty.get(), fit, vp, s);
      go(s, o.x, o.y);
      scheduleOnRN(report, s);
    },
  });

  const pan = usePanGesture({
    onUpdate: (e) => {
      "worklet";
      if (scale.get() <= 1) return;
      const vp = { width: vpW.get(), height: vpH.get() };
      const fit = { width: fitW.get(), height: fitH.get() };
      const o = clampOffset(tx.get() + e.changeX, ty.get() + e.changeY, fit, vp, scale.get());
      tx.set(o.x);
      ty.set(o.y);
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onActivate: (e) => {
      "worklet";
      const s = scale.get() > 1.01 ? zoomTo(1, vpW.get() / 2, vpH.get() / 2) : zoomTo(DOUBLE_TAP_SCALE, e.x, e.y);
      scheduleOnRN(report, s);
    },
  });

  const gestures = useSimultaneousGestures(pinch, pan, doubleTap);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const prev = lastLayout.current;
    if (prev && prev.width === width && prev.height === height) return;
    lastLayout.current = { width, height };
    const fit = fitSize(contentSize, { width, height });
    vpW.set(width);
    vpH.set(height);
    fitW.set(fit.width);
    fitH.set(fit.height);
    // A new size (fold, unfold, rotate) starts over at fit: the old offsets mean nothing there.
    scale.set(1);
    tx.set(0);
    ty.set(0);
    setViewport({ width, height });
    setPercent(100);
  };

  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    const k = e.nativeEvent.actionName === "zoomIn" ? A11Y_STEP : e.nativeEvent.actionName === "zoomOut" ? 1 / A11Y_STEP : null;
    if (k === null) return;
    // Snap to a whole percent so repeated steps land exactly on the 1x and 5x ends.
    report(zoomTo(Math.round(scale.get() * k * 100) / 100, vpW.get() / 2, vpH.get() / 2));
  };

  const fitted = viewport ? fitSize(contentSize, viewport) : null;

  return (
    // Own root: React Native's Modal is a separate native root, outside the app's gesture root.
    <GestureHandlerRootView style={{ flex: 1 }}>
    <GestureDetector gesture={gestures}>
      <View
        testID="zoom-surface"
        onLayout={onLayout}
        style={{ flex: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t("review.receiptPhoto")}
        accessibilityValue={{ text: `${percent}%` }}
        accessibilityActions={[
          { name: "zoomIn", label: t("review.zoomIn") },
          { name: "zoomOut", label: t("review.zoomOut") },
        ]}
        onAccessibilityAction={onAccessibilityAction}
      >
        {fitted ? (
          <Animated.View style={[{ width: fitted.width, height: fitted.height }, imageStyle]}>
            <Image testID="zoom-image" source={{ uri }} cachePolicy="none" contentFit="contain" style={{ width: "100%", height: "100%" }} />
          </Animated.View>
        ) : null}
      </View>
    </GestureDetector>
    </GestureHandlerRootView>
  );
}
