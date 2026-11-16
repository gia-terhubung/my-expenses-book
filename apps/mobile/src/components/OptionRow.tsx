import { Pressable, Text } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

/** Single-choice row shared by the pickers (radio semantics, 48dp touch target). */
export function OptionRow({
  label,
  detail,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={{
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
        borderWidth: 1,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
      }}
    >
      {/* Full row width when alone: Android measures the bold label short and clips its wrap ("Spreadsheet CSV"). */}
      <Text
        style={[
          theme.type.body,
          { color: selected ? theme.colors.onPrimary : theme.colors.text, fontWeight: "600" },
          detail ? { flexShrink: 1 } : { flex: 1 },
        ]}
      >
        {label}
      </Text>
      {detail ? (
        <Text numberOfLines={1} style={[theme.type.body, { flex: 1, color: selected ? theme.colors.onPrimary : theme.colors.textMuted }]}>
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
}
