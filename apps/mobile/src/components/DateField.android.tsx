import { Host } from "@expo/ui";
import { DatePickerDialog } from "@expo/ui/jetpack-compose";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/theme/ThemeProvider";

import { DateFieldShell, type DateFieldProps } from "./DateFieldText";
import { stringToUtcDate, utcDateToString } from "./dateString";

export type { DateFieldProps } from "./DateFieldText";

/** Android: tap the field to open the native Material date dialog (it speaks UTC midnight). */
export function DateField({ label, value, onChange, error, hint, testID, disabled, placeholder }: DateFieldProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <DateFieldShell label={label} hint={hint} error={error}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={error}
        accessibilityValue={{ text: value }}
        disabled={disabled}
        onPress={() => setOpen(true)}
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
        <Text style={[theme.type.body, { color: value ? theme.colors.text : theme.colors.textMuted }]}>{value || placeholder || "—"}</Text>
      </Pressable>
      {open ? (
        <Host>
          <DatePickerDialog
            initialDate={value ? stringToUtcDate(value).toISOString() : null}
            confirmButtonLabel={t("common.done")}
            dismissButtonLabel={t("common.cancel")}
            onDateSelected={(d) => {
              setOpen(false);
              onChange(utcDateToString(d));
            }}
            onDismissRequest={() => setOpen(false)}
          />
        </Host>
      ) : null}
    </DateFieldShell>
  );
}
