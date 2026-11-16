import { StatusBar } from "expo-status-bar";

import { useTheme } from "./ThemeProvider";

/** Status-bar icons that contrast with the app theme; without it HyperOS draws white icons on light screens. */
export function ThemedStatusBar() {
  const theme = useTheme();
  return <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />;
}
