import { createContext, useContext, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { tokens, type Theme } from "./tokens";

const ThemeContext = createContext<Theme | null>(null);

/** Follows the system color scheme. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  return <ThemeContext.Provider value={tokens[scheme === "dark" ? "dark" : "light"]}>{children}</ThemeContext.Provider>;
}

/** Falls back to the light theme outside a provider. */
export function useTheme(): Theme {
  return useContext(ThemeContext) ?? tokens.light;
}
