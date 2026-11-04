import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

/** Placeholder screen body: translated title plus empty-state text. */
export function EmptyState({ title, message, children }: { title: string; message?: string; children?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.fill, { backgroundColor: theme.colors.background, padding: theme.spacing.xl, gap: theme.spacing.md }]}>
      <Text accessibilityRole="header" style={[theme.type.headline, { color: theme.colors.text }]}>
        {title}
      </Text>
      {message ? <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{message}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
