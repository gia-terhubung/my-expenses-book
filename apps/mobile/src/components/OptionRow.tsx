import { Pressable, Text } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

/** Choice row shared by the pickers and filters (radio or checkbox semantics, 48dp touch target). */
export function OptionRow({
  label,
  detail,
  selected,
  onPress,
  accessibilityLabel,
  role = "radio",
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  role?: "radio" | "checkbox";
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.control,
        borderCurve: "continuous",
        backgroundColor: selected
          ? pressed
            ? theme.colors.primaryPressed
            : theme.colors.primary
          : pressed
            ? theme.colors.surfacePressed
            : theme.colors.surface,
        borderWidth: 1,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
      })}
    >
      {/* Full row width when alone: Android measures the bold label short and clips its wrap ("Spreadsheet CSV"). */}
      <Text
        style={[
          theme.type.label,
          { color: selected ? theme.colors.onPrimary : theme.colors.text },
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
