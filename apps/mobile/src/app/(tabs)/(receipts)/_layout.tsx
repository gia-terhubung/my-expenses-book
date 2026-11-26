import { Stack } from "expo-router";

import { useTheme } from "@/theme/ThemeProvider";

/**
 * SPIKE: Receipts gets its own native Stack so the iOS + can be a native bottom toolbar button
 * (variant D); toolbars belong to a stack screen. No visible header.
 */
export default function ReceiptsStack() {
  const theme = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }} />;
}
