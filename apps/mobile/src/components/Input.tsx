import { useState } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

export type InputProps = TextInputProps & {
  /** Warning/error border colour; wins over the focus ring and thickens the border to 2. */
  flagColor?: string;
};

/** App text field: control radius, 1.5 border, primary border + tonal ring when focused. */
export function Input({ flagColor, style, onFocus, onBlur, ...rest }: InputProps) {
  const { colors, radius } = useTheme();
  const [focused, setFocused] = useState(false);
  const chrome = {
    borderRadius: radius.control,
    borderCurve: "continuous" as const,
    borderWidth: flagColor ? 2 : 1.5,
    borderColor: flagColor ?? (focused ? colors.primary : colors.border),
    ...(focused && !flagColor ? { boxShadow: `0 0 0 4px ${colors.tonal}` } : null),
  };
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={StyleSheet.compose(style, chrome)}
    />
  );
}
