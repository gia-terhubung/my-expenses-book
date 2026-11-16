import { Pressable, StyleProp, View, ViewStyle } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

export type CardProps = {
  children: React.ReactNode;
  onPress?: () => void; // present: Pressable with accessibilityRole="button"
  disabled?: boolean;
  tone?: "surface" | "background"; // default "surface"
  selected?: boolean; // tonal fill
  accessibilityLabel?: string;
  accessible?: boolean; // static cards that read as one element
  testID?: string;
  style?: StyleProp<ViewStyle>; // layout only; merged last
};

/** Flat row container: hairline border, no shadow. */
export function Card({ children, onPress, disabled, tone = "surface", selected, accessibilityLabel, accessible, testID, style }: CardProps) {
  const { colors, spacing, size, radius, state } = useTheme();
  const base: ViewStyle = {
    minHeight: size.row,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: selected ? colors.tonal : colors[tone],
    opacity: disabled ? state.disabledOpacity : 1,
  };

  if (!onPress) {
    return (
      <View accessible={accessible} accessibilityLabel={accessibilityLabel} testID={testID} style={[base, style]}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [base, pressed ? { backgroundColor: colors.surfacePressed } : null, style]}
    >
      {children}
    </Pressable>
  );
}
