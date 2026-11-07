import { Host } from "@expo/ui";
import { DatePicker } from "@expo/ui/swift-ui";
import { useMemo } from "react";
import { View } from "react-native";

import { DateFieldShell, type DateFieldProps } from "./DateFieldText";
import { dateToLocalString, localStringToDate } from "./dateString";

export type { DateFieldProps } from "./DateFieldText";

/** iOS: native SwiftUI compact DatePicker (tap to open the calendar). */
export function DateField({ label, value, onChange, error, hint, testID, disabled }: DateFieldProps) {
  const selection = useMemo(() => localStringToDate(value), [value]);
  return (
    <DateFieldShell label={label} hint={hint} error={error}>
      <View
        testID={testID}
        accessible
        accessibilityLabel={label}
        accessibilityHint={error}
        pointerEvents={disabled ? "none" : "auto"}
        style={{ minHeight: 48, justifyContent: "center", alignItems: "flex-start" }}
      >
        <Host matchContents>
          <DatePicker title={label} selection={selection} displayedComponents={["date"]} onDateChange={(d) => onChange(dateToLocalString(d))} />
        </Host>
      </View>
    </DateFieldShell>
  );
}
