import type { ColorTokens } from "@/theme/tokens";

/**
 * Root stack defaults. Headers are opt-in per route. iOS uses the back title as the back button's
 * VoiceOver label; without one it reads the previous route's name, e.g. "(tabs)". Native headers
 * (Kotak tip, Error log, Backup, receipt) take the theme's page colours, not the platform default.
 */
export function rootStackOptions(t: (key: string) => string, colors: ColorTokens) {
  return {
    headerShown: false,
    headerBackTitle: t("common.back"),
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.primary,
    headerTitleStyle: { color: colors.text },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.background },
  };
}
