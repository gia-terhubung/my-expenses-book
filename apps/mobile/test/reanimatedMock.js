// Stand-in for react-native-reanimated in the jest-expo project. Animated components are the plain
// React Native ones, so CSS animation/transition style keys stay readable on `props.style`.
const { Image, ScrollView, Text, View } = require("react-native");

const useReducedMotion = jest.fn(() => false);
const cubicBezier = (x1, y1, x2, y2) => `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
const Animated = { View, Text, Image, ScrollView, createAnimatedComponent: (c) => c };

module.exports = { __esModule: true, default: Animated, useReducedMotion, cubicBezier };
