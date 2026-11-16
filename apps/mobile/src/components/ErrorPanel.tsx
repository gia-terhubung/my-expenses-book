import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { logError } from "@/errorLog/instance";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Themed full-screen error: title, optional raw details behind a toggle, Retry. With `scope`,
 * the details go to the local error log once per distinct message.
 */
export function ErrorPanel({
  title,
  details,
  onRetry,
  scope,
}: {
  title: string;
  details?: string;
  onRetry?: () => void;
  scope?: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (scope && details) logError(scope, new Error(details));
  }, [scope, details]);
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        padding: theme.spacing.xl,
        gap: theme.spacing.lg,
        backgroundColor: theme.colors.background,
      }}
    >
      <Text style={[theme.type.title, { color: theme.colors.text }]}>{title}</Text>
      {details ? (
        <>
          <Button
            variant="quiet"
            align="center"
            label={show ? t("errors.hideDetails") : t("errors.showDetails")}
            onPress={() => setShow((s) => !s)}
          />
          {show ? (
            <ScrollView style={{ maxHeight: 200 }}>
              <Text selectable style={[theme.type.caption, { color: theme.colors.textMuted }]}>
                {details}
              </Text>
            </ScrollView>
          ) : null}
        </>
      ) : null}
      {onRetry ? (
        <Button variant="primary" label={t("errors.retry")} onPress={onRetry} />
      ) : null}
    </View>
  );
}
