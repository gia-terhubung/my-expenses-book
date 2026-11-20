import { Host } from "@expo/ui";
import { DatePicker } from "@expo/ui/swift-ui";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/theme/ThemeProvider";

import { DateFieldShell, type DateFieldProps } from "./DateFieldText";
import { dateToLocalString, localStringToDate, spokenDate } from "./dateString";

export type { DateFieldProps } from "./DateFieldText";

/** iOS: native SwiftUI compact DatePicker (tap to open the calendar). */
export function DateField({ label, value, onChange, error, hint, testID, disabled, placeholder }: DateFieldProps) {
  const theme = useTheme();
  const { i18n } = useTranslation();
  const selection = useMemo(() => localStringToDate(value), [value]);
  return (
    <DateFieldShell label={label} hint={hint} error={error}>
      {value ? (
        <View
          testID={testID}
          accessible
          accessibilityLabel={label}
          // The grouped native picker is not read out: VoiceOver gets the date from here.
          accessibilityValue={{ text: spokenDate(value, i18n?.language || "en") }}
          accessibilityHint={error}
          pointerEvents={disabled ? "none" : "auto"}
          style={{ minHeight: 48, justifyContent: "center", alignItems: "flex-start" }}
        >
          <Host matchContents>
            <DatePicker selection={selection} displayedComponents={["date"]} onDateChange={(d) => onChange(dateToLocalString(d))} />
          </Host>
        </View>
      ) : (
        // No value yet: a picker would show today without holding it. Tapping sets today, then the picker takes over.
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={error}
          disabled={disabled}
          onPress={() => onChange(dateToLocalString(new Date()))}
          style={{
            minHeight: 48,
            justifyContent: "center",
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.md,
            borderWidth: hint || error ? 2 : 1,
            borderColor: error ? theme.colors.danger : hint ? theme.colors.warning : theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}
        >
          <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{placeholder || "—"}</Text>
        </Pressable>
      )}
    </DateFieldShell>
  );
}
