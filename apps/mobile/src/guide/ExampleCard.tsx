import { Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

/** A live example ("This month" / "Oct 25 – Nov 24"): a small slip-ruled card in the page colours. */
export function ExampleCard({ label, value, testID }: { label?: string; value: string; testID?: string }) {
  const { colors, type, spacing, radius } = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label ? `${label}, ${value}` : value}
      style={{
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        gap: 2,
      }}
    >
      {label ? <Text style={[type.caption, { color: colors.textMuted }]}>{label}</Text> : null}
      <Text style={[type.label, { color: colors.text }]}>{value}</Text>
    </View>
  );
}
