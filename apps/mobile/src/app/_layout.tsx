import { getLocales } from "expo-localization";
import { install } from "react-native-quick-crypto";
import { Redirect, Stack, useSegments } from "expo-router";

import { DatabaseProvider } from "@/db/DatabaseProvider";
import { initI18n } from "@/i18n";
import { resolveLanguage } from "@/i18n/resolve";
import { LockGate } from "@/lock/LockGate";
import { PrefsProvider, usePref } from "@/prefs/PrefsProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";

// Provides global crypto.getRandomValues (needed by uuidv7).
install();

// Device-locale language first (also used by the db-error screen, which renders before prefs
// can open); PrefsProvider switches to the saved language once prefs are available.
initI18n(resolveLanguage(getLocales()));

/** First-run: send everything except /onboarding there until the flow is done (no loop). */
function OnboardingRedirect() {
  const step = usePref("onboardingStep");
  const segments = useSegments() as string[];
  if (step === "done" || segments[0] === "onboarding") return null;
  return <Redirect href="/onboarding" />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <DatabaseProvider>
        <PrefsProvider>
          <LockGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="document/[id]" options={{ headerShown: true }} />
            </Stack>
            <OnboardingRedirect />
          </LockGate>
        </PrefsProvider>
      </DatabaseProvider>
    </ThemeProvider>
  );
}
