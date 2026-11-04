import { getLocales } from "expo-localization";
import { install } from "react-native-quick-crypto";
import { Stack } from "expo-router";

import { DatabaseProvider } from "@/db/DatabaseProvider";
import { initI18n } from "@/i18n";
import { resolveLanguage } from "@/i18n/resolve";
import { PrefsProvider } from "@/prefs/PrefsProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";

// Provides global crypto.getRandomValues (needed by uuidv7).
install();

// Device-locale language first (also used by the db-error screen, which renders before prefs
// can open); PrefsProvider switches to the saved language once prefs are available.
initI18n(resolveLanguage(getLocales()));

export default function RootLayout() {
  return (
    <ThemeProvider>
      <DatabaseProvider>
        <PrefsProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="document/[id]" options={{ headerShown: true }} />
          </Stack>
        </PrefsProvider>
      </DatabaseProvider>
    </ThemeProvider>
  );
}
