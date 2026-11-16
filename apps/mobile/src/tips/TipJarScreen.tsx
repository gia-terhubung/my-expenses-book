import { useTranslation } from "react-i18next";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { TipId, TipJar } from "@/payments/types";
import { useTheme } from "@/theme/ThemeProvider";

import { useTipJar } from "./useTipJar";

const TIER_KEYS: Record<TipId, string> = {
  tip_coffee_small: "tips.small",
  tip_coffee_standard: "tips.standard",
  tip_coffee_generous: "tips.generous",
};

export function TipJarScreen({ jar }: { jar: TipJar }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { state, products, thanked, notice, buy, retry } = useTipJar(jar);
  const busy = state === "buying";

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: theme.spacing.xl }}>
      <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: theme.spacing.lg }}>
        <Text style={[theme.type.body, { color: theme.colors.text }]}>{t("tips.intro")}</Text>

        {state === "loading" ? (
          <ActivityIndicator accessibilityLabel={t("tips.loading")} color={theme.colors.primary} />
        ) : null}

        {state === "unavailable" ? (
          <View style={{ gap: theme.spacing.md }}>
            <Text accessibilityLiveRegion="polite" style={[theme.type.body, { color: theme.colors.textMuted }]}>
              {t("tips.unavailable")}
            </Text>
            <Button variant="quiet" label={t("tips.retry")} onPress={retry} style={{ alignSelf: "flex-start" }} />
          </View>
        ) : null}

        {state === "ready" || busy
          ? products.map((p) => {
              const tier = t(TIER_KEYS[p.id]);
              return (
                <Card
                  key={p.id}
                  accessibilityLabel={`${tier}, ${p.displayPrice}`}
                  disabled={busy}
                  onPress={() => buy(p.id)}
                  style={{ justifyContent: "space-between" }}
                >
                  <Text style={[theme.type.body, { color: theme.colors.text }]}>{tier}</Text>
                  <Text style={[theme.type.body, { color: theme.colors.primary, fontWeight: "600" }]}>{p.displayPrice}</Text>
                </Card>
              );
            })
          : null}

        <View accessibilityLiveRegion="polite">
          {thanked ? <Text style={[theme.type.body, { color: theme.colors.text }]}>{t("tips.thanks")}</Text> : null}
          {notice ? (
            <Text style={[theme.type.body, { color: notice === "failed" ? theme.colors.danger : theme.colors.text }]}>
              {t(`tips.${notice}`)}
            </Text>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}
