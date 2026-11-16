import { StatusBar, type StatusBarStyle } from "expo-status-bar";

import { useTheme } from "./ThemeProvider";

/** Icons that contrast with the theme's page background. */
export function themedStatusBarStyle(scheme: "light" | "dark"): StatusBarStyle {
  return scheme === "dark" ? "light" : "dark";
}

/** Status-bar icons that contrast with the app theme; without it HyperOS draws white icons on light screens. */
export function ThemedStatusBar() {
  const theme = useTheme();
  return <StatusBar style={themedStatusBarStyle(theme.scheme)} />;
}
