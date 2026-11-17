/**
 * Root stack defaults. Headers are opt-in per route. iOS uses the back title as the back button's
 * VoiceOver label; without one it reads the previous route's name, e.g. "(tabs)".
 */
export function rootStackOptions(t: (key: string) => string) {
  return { headerShown: false, headerBackTitle: t("common.back") };
}
