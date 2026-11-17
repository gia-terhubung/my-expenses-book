import { Stack } from "expo-router";

import { ModalSideInset } from "@/layout/ModalSideInset";

/**
 * Capture + review flow, presented as one native modal (root Stack: presentation "modal"). The
 * modal is its own window, so the stack is padded by the root side insets here.
 */
export default function ModalsLayout() {
  return (
    <ModalSideInset>
      <Stack screenOptions={{ headerShown: false }} />
    </ModalSideInset>
  );
}
