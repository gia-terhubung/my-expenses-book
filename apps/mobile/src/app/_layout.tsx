import { getLocales } from "expo-localization";
import { install } from "react-native-quick-crypto";
import { Redirect, Stack, useSegments, type ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";

import { ErrorPanel } from "@/components/ErrorPanel";
import { assertSecureRandom } from "@/crypto/secureRandom";
import { logError } from "@/errorLog/instance";
import { DatabaseProvider } from "@/db/DatabaseProvider";
import { ImageStoreProvider } from "@/images/ImageStoreProvider";
import { initI18n } from "@/i18n";
import { resolveLanguage } from "@/i18n/resolve";
import { SideSafeArea, useSideInsets } from "@/layout/SideSafeArea";
import { rootStackOptions } from "@/layout/stackOptions";
import { useFx } from "@/fx/useFx";
import { LockGate } from "@/lock/LockGate";
import { PrefsProvider, usePref } from "@/prefs/PrefsProvider";
import { useNotificationTap } from "@/recurring/useNotificationTap";
import { useRecurringCatchUp } from "@/recurring/useRecurringCatchUp";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";
import { ThemedStatusBar } from "@/theme/ThemedStatusBar";
import { useAppFonts } from "@/theme/useAppFonts";

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

/** Renders nothing; runs FX refresh + re-convert under PrefsProvider and DatabaseProvider. */
function FxSync() {
  useFx();
  return null;
}

/**
 * Renders nothing; creates due recurring expenses and opens the draft a notification tap points at. Inside LockGate, so it only runs while the app
 * is unlocked and uncovered. Home reads the result through the same hook (shared module state).
 */
function RecurringCatchUp() {
  const { runNow } = useRecurringCatchUp();
  // A due-day notification tap opens its draft (deferred while locked).
  useNotificationTap(runNow);
  return null;
}

function ErrorFallback({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  useEffect(() => logError("render", error), [error]);
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

/** The root stack; inside ThemeProvider so native headers can take the theme's colours. */
function AppStack() {
  const { t } = useTranslation();
  const theme = useTheme();
  const side = useSideInsets();
  const base = rootStackOptions(t, theme.colors);
  // iOS: the root no longer pads the sides (SideSafeArea), so native headers and toolbars can
  // move into the iPhone Duo side column; the screen content pads instead.
  const screenOptions =
    Platform.OS === "ios"
      ? { ...base, contentStyle: { ...base.contentStyle, paddingLeft: side.left, paddingRight: side.right } }
      : base;
  return (
    <Stack screenOptions={screenOptions}>
      {/* iOS: tab screens pad their own sides (TabScreen), so the native tab bar reaches the Duo column. */}
      <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: theme.colors.background } }} />
      {/* Capture + review flow; /lock (fullScreenModal) still presents above it. */}
      <Stack.Screen
        name="(modals)"
        // iOS: the modal stack pads its own screens; padding here too would inset twice.
        options={{ presentation: "modal", contentStyle: { backgroundColor: theme.colors.background } }}
      />
      {/* Settings → Show guide; listed before lock so the lock screen still presents above it. */}
      <Stack.Screen name="guide" options={{ presentation: "fullScreenModal", headerShown: false }} />
      <Stack.Screen name="lock" options={{ presentation: "fullScreenModal", gestureEnabled: false, animation: "none" }} />
    </Stack>
  );
}

export default function RootLayout() {
  // In render (not module scope) so a failure reaches the exported ErrorBoundary rather than
  // letting ids fall back to Math.random.
  assertSecureRandom();
  // Hold the first frame until the display font is ready (or failed: system font fallback).
  const fontsReady = useAppFonts();
  if (!fontsReady) return null;
  return (
    <ThemeProvider>
      <DatabaseProvider>
        <ImageStoreProvider>
          <PrefsProvider>
            <ThemedStatusBar />
            <FxSync />
            <LockGate>
              <SideSafeArea>
                <AppStack />
              </SideSafeArea>
              <OnboardingRedirect />
              <RecurringCatchUp />
            </LockGate>
          </PrefsProvider>
        </ImageStoreProvider>
      </DatabaseProvider>
    </ThemeProvider>
  );
}
