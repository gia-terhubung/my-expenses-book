// Stand-in for react-native-reanimated in the jest-expo project. Animated components are the plain
// React Native ones, so CSS animation/transition style keys stay readable on `props.style`.
const { useRef } = require("react");
const { Image, ScrollView, Text, View } = require("react-native");

const useReducedMotion = jest.fn(() => false);
const cubicBezier = (x1, y1, x2, y2) => `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
const Animated = { View, Text, Image, ScrollView, createAnimatedComponent: (c) => c };

// Shared values are plain refs; animations jump to their target; animated styles are computed per render.
const useSharedValue = (initial) => useRef({ value: initial }).current;
const useAnimatedStyle = (fn) => fn();
const withTiming = (to) => to;
const withSpring = (to) => to;
// What react-native-gesture-handler's hook API reads from Reanimated; gestures never fire under Jest.
const useEvent = (handler) => handler;
const useHandler = () => ({ context: {}, doDependenciesDiffer: false, useWeb: false });
const useComposedEventHandler = () => () => {};
const isSharedValue = () => false;
const setGestureState = () => {};

module.exports = {
  useEvent,
  useHandler,
  useComposedEventHandler,
  isSharedValue,
  setGestureState,
  __esModule: true,
  default: Animated,
  useReducedMotion,
  cubicBezier,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
};
