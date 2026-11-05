import { getLocales } from "expo-localization";
import { install } from "react-native-quick-crypto";
import { Redirect, Stack, useSegments, type ErrorBoundaryProps } from "expo-router";
import { useTranslation } from "react-i18next";

import { ErrorPanel } from "@/components/ErrorPanel";
import { assertSecureRandom } from "@/crypto/secureRandom";
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

function ErrorFallback({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  return <ErrorPanel title={t("common.error")} details={error.message} onRetry={() => void retry()} />;
}

/** Expo Router root error boundary: replaces the layout, so it brings its own ThemeProvider. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <ThemeProvider>
      <ErrorFallback {...props} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // In render (not module scope) so a failure reaches the exported ErrorBoundary rather than
  // letting ids fall back to Math.random.
  assertSecureRandom();
  return (
    <ThemeProvider>
      <DatabaseProvider>
        <PrefsProvider>
          <LockGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="document/[id]" options={{ headerShown: true }} />
              <Stack.Screen
                name="lock"
                options={{ presentation: "fullScreenModal", gestureEnabled: false, animation: "none" }}
              />
            </Stack>
            <OnboardingRedirect />
          </LockGate>
        </PrefsProvider>
      </DatabaseProvider>
    </ThemeProvider>
  );
}
