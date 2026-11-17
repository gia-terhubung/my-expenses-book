import { ActivityIndicator, Pressable, StyleProp, Text, View, ViewStyle } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "quiet" | "highlight"; // default "secondary"; "highlight" is the yellow fill with ink text
  tone?: "default" | "danger" | "muted"; // "muted" is for quiet only
  align?: "center" | "start"; // default: "start" for quiet, else "center"
  detail?: string;
  disabled?: boolean;
  busy?: boolean; // implies non-interactive
  busyIndicator?: boolean; // default true; false keeps the label visible
  shrinkLabel?: boolean; // one line, shrunk to fit: for labels that must never wrap or ellipsize (prices)
  onPressIn?: () => void;
  onPressOut?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>; // layout only; merged last
};

export function Button({
  label,
  onPress,
  variant = "secondary",
  tone = "default",
  align,
  detail,
  disabled,
  busy,
  busyIndicator = true,
  shrinkLabel,
  onPressIn,
  onPressOut,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const { colors, spacing, size, radius, state } = theme;
  const inert = !!disabled || !!busy;
  const textAlign = align ?? (variant === "quiet" ? "start" : "center");
  const danger = tone === "danger";

  let fill = "transparent";
  let fillPressed = "transparent";
  let labelColor = danger ? colors.danger : colors.primary;
  if (variant === "primary") {
    fill = colors.primary;
    fillPressed = colors.primaryPressed;
    labelColor = colors.onPrimary;
  } else if (variant === "highlight") {
    fill = colors.highlight;
    fillPressed = colors.highlight;
    labelColor = colors.onHighlight;
  } else if (variant === "secondary") {
    fill = danger ? colors.tonalDanger : colors.tonal;
    fillPressed = danger ? colors.tonalDanger : colors.tonalPressed;
  } else if (tone === "muted") {
    labelColor = colors.textMuted;
  }
  if (disabled && variant !== "quiet") {
    fill = colors.tonal;
    fillPressed = colors.tonal;
    labelColor = colors.textMuted;
  } else if (disabled) {
    labelColor = colors.textMuted;
  }
  const detailColor = variant === "primary" && !disabled ? colors.onPrimary : colors.textMuted;
  const showSpinner = !!busy && busyIndicator;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inert, busy: !!busy }}
      disabled={inert}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      testID={testID}
      style={({ pressed }) => [
        {
          minHeight: size.touch,
          minWidth: size.touch,
          paddingVertical: spacing.sm,
          paddingHorizontal: variant === "quiet" ? 0 : spacing.lg,
          justifyContent: "center",
          alignItems: textAlign === "center" ? "center" : "flex-start",
          borderRadius: radius.control,
          borderCurve: "continuous",
          backgroundColor: pressed && !inert ? fillPressed : fill,
        },
        variant === "primary" && !disabled && theme.scheme === "light"
          ? { boxShadow: "0 6px 14px -8px rgba(31,92,76,0.7)" }
          : null,
        variant === "primary" && pressed && !inert ? { transform: [{ translateY: 1 }] } : null,
        variant === "quiet" && pressed && !inert ? { opacity: state.pressedOpacity } : null,
        // Ink on yellow must stay on yellow: dim instead of changing the fill.
        variant === "highlight" && pressed && !inert ? { opacity: 0.85 } : null,
        variant === "secondary" && danger && pressed && !inert ? { opacity: 0.85 } : null,
        style,
      ]}
    >
      <Text
        numberOfLines={shrinkLabel ? 1 : undefined}
        adjustsFontSizeToFit={shrinkLabel ? true : undefined}
        minimumFontScale={shrinkLabel ? 0.5 : undefined}
        style={[
          theme.type.label,
          // Stretched so the text has a definite width to shrink into.
          shrinkLabel ? { alignSelf: "stretch" } : null,
          {
            color: labelColor,
            textAlign: textAlign === "center" ? "center" : "left",
            opacity: showSpinner ? 0 : 1,
          },
          variant === "quiet" && tone !== "muted" ? { textDecorationLine: "underline" } : null,
        ]}
      >
        {label}
      </Text>
      {detail ? (
        <Text
          style={[
            theme.type.caption,
            { color: detailColor, textAlign: textAlign === "center" ? "center" : "left", opacity: showSpinner ? 0 : 1 },
          ]}
        >
          {detail}
        </Text>
      ) : null}
      {showSpinner ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator color={labelColor} />
        </View>
      ) : null}
    </Pressable>
  );
}
