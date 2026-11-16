import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { Input } from "@/components/Input";

export type DateFieldProps = {
  label: string;
  /** Local YYYY-MM-DD, or "" when unset. */
  value: string;
  onChange: (value: string) => void;
  /** Already-translated error text. */
  error?: string;
  /** Already-translated "check this" marker for low-confidence values. */
  hint?: string;
  testID?: string;
  disabled?: boolean;
  placeholder?: string;
};

/** Label, optional hint, content and error line shared by every DateField variant. */
export function DateFieldShell({ label, hint, error, children }: Pick<DateFieldProps, "label" | "hint" | "error"> & { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, flexWrap: "wrap" }}>
        <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>{label}</Text>
        {hint ? <Text style={[theme.type.caption, { color: theme.colors.warning, fontWeight: "600" }]}>{hint}</Text> : null}
      </View>
      {children}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[theme.type.caption, { color: theme.colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Typed-text date field: web and the base for tests. */
export function DateFieldText({ label, value, onChange, error, hint, testID, disabled, placeholder }: DateFieldProps) {
  const theme = useTheme();
  return (
    <DateFieldShell label={label} hint={hint} error={error}>
      <Input
        testID={testID}
        flagColor={error ? theme.colors.danger : hint ? theme.colors.warning : undefined}
        accessibilityLabel={label}
        accessibilityHint={error}
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        style={[
          theme.type.body,
          {
            minHeight: 48,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            
            
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
          },
        ]}
      />
    </DateFieldShell>
  );
}
