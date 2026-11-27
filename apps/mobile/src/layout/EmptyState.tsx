import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";

/**
 * Placeholder screen body: translated title plus empty-state text. `topInset={false}` when the
 * host already applies the status-bar inset (e.g. a list header spacer above the empty state).
 */
export function EmptyState({
  title,
  message,
  children,
  topInset = true,
}: {
  title: string;
  message?: string;
  children?: React.ReactNode;
  topInset?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="empty-state"
      style={[
        styles.fill,
        {
          backgroundColor: theme.colors.background,
          padding: theme.spacing.xl,
          paddingTop: (topInset ? insets.top : 0) + theme.spacing.xl,
          gap: theme.spacing.md,
        },
      ]}
    >
      <Text
        accessibilityRole="header"
        style={[theme.type.headline, { color: theme.colors.text }]}
      >
        {title}
      </Text>
      {message ? (
        <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>
          {message}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
