import { Link } from "expo-router";
import { ScrollView, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/layout/EmptyState";
import { useTheme } from "@/theme/ThemeProvider";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ backgroundColor: theme.colors.background }}>
      <EmptyState title={t("settings.title")}>
        {__DEV__ && (
          <>
            <Text style={[theme.type.title, { color: theme.colors.text }]}>{t("settings.devTools")}</Text>
            <Link href="/db-spike">DB spike</Link>
            <Link href="/ai-spike">AI spike</Link>
            <Link href="/db-check">DB check</Link>
          </>
        )}
      </EmptyState>
    </ScrollView>
  );
}
