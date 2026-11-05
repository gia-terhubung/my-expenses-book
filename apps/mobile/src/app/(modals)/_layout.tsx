import { Stack } from "expo-router";

/** Capture + review flow, presented as one native modal (root Stack: presentation "modal"). */
export default function ModalsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
