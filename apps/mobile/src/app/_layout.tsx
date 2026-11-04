import { install } from "react-native-quick-crypto";
import { Stack } from "expo-router";

import { DatabaseProvider } from "@/db/DatabaseProvider";

// Provides global crypto.getRandomValues (needed by uuidv7).
install();

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <Stack />
    </DatabaseProvider>
  );
}
