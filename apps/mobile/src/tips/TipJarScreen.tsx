import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState, type ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { cubicBezier, useReducedMotion } from "react-native-reanimated";

import { Button } from "@/components/Button";
import type { TipId, TipJar, TipProduct } from "@/payments/types";
import { FONTS } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";

import { TipBackdrop } from "./TipBackdrop";
import { useTipJar, type TipNotice } from "./useTipJar";

type CupIcon = ComponentProps<typeof MaterialCommunityIcons>["name"];

const TIERS: Record<TipId, { label: string; note: string; icon: CupIcon }> = {
  tip_coffee_small: { label: "tips.small", note: "tips.smallNote", icon: "coffee-outline" },
  tip_coffee_standard: { label: "tips.standard", note: "tips.standardNote", icon: "coffee" },
  tip_coffee_generous: { label: "tips.generous", note: "tips.generousNote", icon: "coffee-to-go" },
};

const PRESS_EASE = cubicBezier(0.23, 1, 0.32, 1);
const ICON_CHIP = 44;

function Tier({ product, disabled, onPress }: { product: TipProduct; disabled: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { colors, spacing, radius, state } = theme;
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const tier = TIERS[product.id];
  const label = t(tier.label);
  const special = product.id === "tip_coffee_generous";
  const down = pressed && !disabled;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${product.displayPrice}`}
      accessibilityHint={t(tier.note)}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      pressRetentionOffset={12}
    >
      <Animated.View
        testID={`tip-tier-${product.id}`}
        style={[
          {
            minHeight: 68,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderRadius: radius.control,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: down ? colors.surfacePressed : colors.surface,
            opacity: disabled ? state.disabledOpacity : 1,
          },
          // Press feedback: a small, quick scale. Under reduce motion only the fill changes.
          reduced
            ? null
            : {
                transform: [{ scale: down ? 0.97 : 1 }],
                transitionProperty: "transform",
                transitionDuration: 120,
                transitionTimingFunction: PRESS_EASE,
              },
        ]}
      >
        <View
          testID={`tip-icon-${product.id}`}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: ICON_CHIP,
            height: ICON_CHIP,
            borderRadius: ICON_CHIP / 2,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: special ? colors.highlight : colors.tonal,
          }}
        >
          <MaterialCommunityIcons name={tier.icon} size={24} color={special ? colors.onHighlight : colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: FONTS.bold, fontSize: 17, lineHeight: 22, color: colors.text }}>{label}</Text>
          <Text style={[theme.type.caption, { color: colors.textMuted }]}>{t(tier.note)}</Text>
        </View>
        <View style={{ maxWidth: "42%", flexShrink: 0 }}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
            style={[theme.type.label, theme.type.money, { color: colors.primary, fontWeight: "700", textAlign: "right" }]}
          >
            {product.displayPrice}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

type NoticeKind = "thanks" | Exclude<TipNotice, null>;

function Notice({ kind, text }: { kind: NoticeKind; text: string }) {
  const theme = useTheme();
  const { colors, spacing, radius } = theme;
  const look = {
    thanks: { fill: colors.slip, ink: colors.slipText, icon: "heart" },
    failed: { fill: colors.tonalDanger, ink: colors.danger, icon: "alert-circle-outline" },
    pending: { fill: colors.brassFill, ink: colors.warning, icon: "time-outline" },
    finishLater: { fill: colors.brassFill, ink: colors.warning, icon: "checkmark-circle-outline" },
  } as const;
  const { fill, ink, icon } = look[kind];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.control,
        borderCurve: "continuous",
        backgroundColor: fill,
      }}
    >
      <Ionicons
        name={icon}
        size={22}
        color={kind === "thanks" ? colors.highlight : ink}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={[theme.type.body, { flex: 1, color: ink }, kind === "thanks" ? { fontWeight: "600" } : null]}>{text}</Text>
    </View>
  );
}

/** `paused` stops the backdrop drift; the route passes it while the screen is not focused. */
export function TipJarScreen({ jar, paused = false }: { jar: TipJar; paused?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { colors, spacing } = theme;
  const { state, products, thanked, notice, buy, retry } = useTipJar(jar);
  const busy = state === "buying";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TipBackdrop paused={paused} />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.xxl }}>
        <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: spacing.lg }}>
          <View style={{ gap: spacing.md }}>
            {/* The app icon's yellow ground, with a cup in ink. */}
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.highlight,
                transform: [{ rotate: "-6deg" }],
              }}
            >
              <MaterialCommunityIcons name="coffee" size={34} color={colors.onHighlight} />
            </View>
            <Text accessibilityRole="header" style={[theme.type.display, { color: colors.text }]}>
              {t("tips.heading")}
            </Text>
            <Text style={[theme.type.body, { color: colors.text }]}>{t("tips.intro")}</Text>
          </View>

          {state === "loading" ? <ActivityIndicator accessibilityLabel={t("tips.loading")} color={colors.primary} /> : null}

          {state === "unavailable" ? (
            <View style={{ gap: spacing.md }}>
              <Text accessibilityLiveRegion="polite" style={[theme.type.body, { color: colors.textMuted }]}>
                {t("tips.unavailable")}
              </Text>
              <Button variant="quiet" label={t("tips.retry")} onPress={retry} style={{ alignSelf: "flex-start" }} />
            </View>
          ) : null}

          {state === "ready" || busy ? (
            <View style={{ gap: spacing.md }}>
              {products.map((p) => (
                <Tier key={p.id} product={p} disabled={busy} onPress={() => buy(p.id)} />
              ))}
            </View>
          ) : null}

          <View accessibilityLiveRegion="polite" style={{ gap: spacing.md }}>
            {thanked ? <Notice kind="thanks" text={t("tips.thanks")} /> : null}
            {notice ? <Notice kind={notice} text={t(`tips.${notice}`)} /> : null}
          </View>

          <Text style={[theme.type.caption, { color: colors.textMuted }]}>{t("tips.optional")}</Text>
        </View>
      </ScrollView>
    </View>
  );
}
