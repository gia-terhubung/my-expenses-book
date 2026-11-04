import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { canEnableLock, type CanEnableLock } from "@/lock/lockPolicy";
import { useTheme } from "@/theme/ThemeProvider";

/** App-lock switch; disabled with an explanation when the device cannot authenticate. */
export function LockToggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [avail, setAvail] = useState<CanEnableLock | null>(null);

  useEffect(() => {
    let cancelled = false;
    canEnableLock().then(
      (r) => !cancelled && setAvail(r),
      () => !cancelled && setAvail({ ok: false, reason: "no_hardware" }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Never trap a user in a state they cannot leave: turning off stays possible while unavailable.
  const disabled = !value && avail?.ok !== true;
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 }}>
        <Text style={[theme.type.body, { color: theme.colors.text, flex: 1 }]}>{label}</Text>
        <Switch
          accessibilityLabel={label}
          value={value}
          disabled={disabled}
          onValueChange={onChange}
          trackColor={{ true: theme.colors.primary }}
        />
      </View>
      {avail && !avail.ok && avail.reason ? (
        <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>
          {t(`settings.lockReason.${avail.reason}`)}
        </Text>
      ) : null}
    </View>
  );
}
