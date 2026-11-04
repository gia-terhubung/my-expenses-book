import { View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

import { OptionRow } from "./OptionRow";

function monthName(lang: string, month: number): string {
  try {
    return new Date(2000, month - 1, 1).toLocaleDateString(lang, { month: "long" });
  } catch {
    return String(month);
  }
}

/** 1-12: the month a tax year starts in. */
export function TaxYearPicker({ lang, value, onChange }: { lang: string; value: number; onChange: (m: number) => void }) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.sm }}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
        <OptionRow key={m} label={monthName(lang, m)} selected={m === value} onPress={() => onChange(m)} />
      ))}
    </View>
  );
}
