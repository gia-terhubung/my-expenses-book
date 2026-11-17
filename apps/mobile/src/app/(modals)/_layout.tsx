import { Stack } from "expo-router";
import { Platform } from "react-native";

import { ModalSideInset } from "@/layout/ModalSideInset";

/**
 * Capture + review flow, presented as one native modal (root Stack: presentation "modal"). On iOS
 * the modal is its own window, so the stack is padded by the root side insets here. On Android the
 * native-stack modal renders inside the root ScreenStack, already inside SideSafeArea: padding it
 * again would inset twice.
 */
export default function ModalsLayout() {
  const stack = <Stack screenOptions={{ headerShown: false }} />;
  return Platform.OS === "ios" ? <ModalSideInset>{stack}</ModalSideInset> : stack;
}
