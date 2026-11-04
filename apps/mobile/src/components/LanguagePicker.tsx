import { View } from "react-native";

import { SUPPORTED_LANGUAGES } from "@/i18n/resolve";
import type { Language } from "@/prefs/prefs";
import { useTheme } from "@/theme/ThemeProvider";

import { OptionRow } from "./OptionRow";

/** Each language in its own name, so it is findable whatever the current UI language. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  id: "Bahasa Indonesia",
  es: "Español",
  "pt-BR": "Português (Brasil)",
};

export function LanguagePicker({ value, onChange }: { value: Language; onChange: (l: Language) => void }) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.sm }}>
      {SUPPORTED_LANGUAGES.map((l) => (
        <OptionRow key={l} label={LANGUAGE_NAMES[l]} selected={l === value} onPress={() => onChange(l)} />
      ))}
    </View>
  );
}
