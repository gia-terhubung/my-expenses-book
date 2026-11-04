import { install } from "react-native-quick-crypto";
import { Stack } from "expo-router";

// Provides global crypto.getRandomValues (needed by uuidv7).
install();

export default function RootLayout() {
  return <Stack />;
}
