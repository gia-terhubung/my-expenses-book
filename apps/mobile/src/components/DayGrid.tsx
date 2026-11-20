import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/theme/ThemeProvider";

const COLUMNS = 7;
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);
const ROWS = Array.from({ length: 4 }, (_, r) => DAYS.slice(r * COLUMNS, (r + 1) * COLUMNS));

/**
 * Days 1-28 as a 7 x 4 calendar page. `value` is the chosen day, or -1 for "Last day"
 * (only offered with `allowLastDay`). Cells are 40 dp with a 48 dp hit area.
 */
export function DayGrid({
  value,
  onChange,
  allowLastDay = false,
}: {
  value: number | -1;
  onChange: (n: number) => void;
  allowLastDay?: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { colors, type, spacing, radius } = theme;
  const cell = (selected: boolean, pressed: boolean) => ({
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: radius.control,
    borderCurve: "continuous" as const,
    borderWidth: 1,
    borderColor: selected ? colors.primary : colors.border,
    backgroundColor: selected ? colors.tonal : pressed ? colors.tonalPressed : colors.surface,
  });
  return (
    <View accessibilityRole="radiogroup" style={{ gap: spacing.xs }}>
      {ROWS.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", gap: spacing.xs }}>
          {row.map((n) => {
            const selected = n === value;
            return (
              <View key={n} style={{ flex: 1, height: 48, alignItems: "center", justifyContent: "center" }}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={t("dayGrid.day", { n })}
                  hitSlop={4}
                  onPress={() => onChange(n)}
                  style={({ pressed }) => [cell(selected, pressed), { width: "100%", maxWidth: 48, height: 40 }]}
                >
                  <Text style={[type.label, type.money, { color: selected ? colors.primary : colors.text }]}>{n}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
      {allowLastDay ? (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: value === -1 }}
          accessibilityLabel={t("dayGrid.lastDay")}
          onPress={() => onChange(-1)}
          style={({ pressed }) => [
            cell(value === -1, pressed),
            { minHeight: 48, alignSelf: "flex-start", paddingHorizontal: spacing.lg, marginTop: spacing.xs },
          ]}
        >
          <Text style={[type.label, { color: value === -1 ? colors.primary : colors.text }]}>{t("dayGrid.lastDay")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
