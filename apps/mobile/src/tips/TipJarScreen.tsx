import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

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
  const { state, products, thanked, failed, buy, retry } = useTipJar(jar);
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
            <Pressable
              accessibilityRole="button"
              onPress={retry}
              style={{ minHeight: 48, justifyContent: "center", alignSelf: "flex-start" }}
            >
              <Text style={[theme.type.body, { color: theme.colors.primary, fontWeight: "600" }]}>{t("tips.retry")}</Text>
            </Pressable>
          </View>
        ) : null}

        {state === "ready" || busy
          ? products.map((p) => {
              const tier = t(TIER_KEYS[p.id]);
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${tier}, ${p.displayPrice}`}
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={() => buy(p.id)}
                  style={{
                    minHeight: 56,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: theme.spacing.lg,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.surface,
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  <Text style={[theme.type.body, { color: theme.colors.text }]}>{tier}</Text>
                  <Text style={[theme.type.body, { color: theme.colors.primary, fontWeight: "600" }]}>{p.displayPrice}</Text>
                </Pressable>
              );
            })
          : null}

        <View accessibilityLiveRegion="polite">
          {thanked ? <Text style={[theme.type.body, { color: theme.colors.text }]}>{t("tips.thanks")}</Text> : null}
          {failed ? <Text style={[theme.type.body, { color: theme.colors.danger }]}>{t("tips.failed")}</Text> : null}
        </View>
      </View>
    </ScrollView>
  );
}
