import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { Button } from "@/components/Button";
import { TIP_IDS, type TipId, type TipJar } from "@/payments/types";
import { FONTS } from "@/theme/fonts";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useTheme } from "@/theme/ThemeProvider";

import { BeanBackdrop } from "./BeanBackdrop";
import { Cup, CUP_STAGE_HEIGHT } from "./Cup";
import { TIP_ART } from "./palette";
import { useTipJar, type TipNotice } from "./useTipJar";

const TIERS: Record<TipId, { label: string; note: string }> = {
  tip_coffee_small: { label: "tips.small", note: "tips.smallNote" },
  tip_coffee_standard: { label: "tips.standard", note: "tips.standardNote" },
  tip_coffee_generous: { label: "tips.generous", note: "tips.generousNote" },
};

/** Three columns need room: at large text or on a narrow screen the cups stack, one per line. */
const STACK_FONT_SCALE = 1.3;
const STACK_WIDTH = 340;

/**
 * One cup on the counter. The whole column is the button: cup, counter segment, name, price, note.
 * Side by side the segments join into one counter line; stacked, each cup stands on its own shelf.
 */
/** Pill text while the store is still answering, and when it has no price for a tier. */
const PRICE_PLACEHOLDER = "…";
const NO_PRICE = "–";

type TierProps = {
  id: TipId;
  /** The store's price text. Without one the tier is shown but can never be bought. */
  price: string | null;
  connecting: boolean;
  /** A purchase is in flight; `buying` says whether it is this tier's. */
  busy: boolean;
  buying: boolean;
  stacked: boolean;
  onPress: () => void;
};

/**
 * One cup on the counter with its price pill. The pill is the tier's only button for screen readers
 * ("<name>, <price>", the note as its hint); the rest of the column is a plain tap area that buys too.
 * Side by side the counter segments join into one line; stacked, each cup stands on its own shelf.
 */
function Tier({ id, price, connecting, busy, buying, stacked, onPress }: TierProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { colors, spacing } = theme;
  const art = TIP_ART[theme.scheme];
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const tier = TIERS[id];
  const label = t(tier.label);
  const note = t(tier.note);
  const disabled = busy || !price;
  const down = pressed && !disabled;
  const textAlign = stacked ? "left" : "center";
  const pressIn = () => setPressed(true);
  const pressOut = () => setPressed(false);

  const stage = (
    <View style={stacked ? { width: 104 } : { alignSelf: "stretch" }}>
      <View style={{ height: CUP_STAGE_HEIGHT, justifyContent: "flex-end", alignItems: "center" }}>
        <Cup id={id} lifted={down} still={reduced} />
      </View>
      <View style={{ height: 2, backgroundColor: art.line }} />
    </View>
  );

  const words = (
    <View style={[{ gap: spacing.sm }, stacked ? { flex: 1 } : { flex: 1, alignSelf: "stretch", paddingHorizontal: spacing.xs }]}>
      {/* Spoken by the pill, so hidden here. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: spacing.xs }}>
        <Text
          // Side by side a one-word name cannot wrap, so it shrinks; stacked it has the full line.
          numberOfLines={stacked ? undefined : 1}
          adjustsFontSizeToFit={!stacked}
          minimumFontScale={0.7}
          style={{ fontFamily: FONTS.bold, fontSize: 16, lineHeight: 21, color: colors.text, textAlign }}
        >
          {label}
        </Text>
        <Text style={[theme.type.caption, { color: colors.textMuted, textAlign }]}>{note}</Text>
      </View>
      <Button
        testID={`tip-price-${id}`}
        // The yellow pill is for a real price only: never an empty or placeholder one.
        variant={id === "tip_coffee_generous" ? "highlight" : "primary"}
        label={price ?? (connecting ? PRICE_PLACEHOLDER : NO_PRICE)}
        accessibilityLabel={price ? `${label}, ${price}` : label}
        accessibilityHint={note}
        shrinkLabel
        disabled={disabled && !buying}
        busy={buying}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        // Notes differ in length; `marginTop: auto` keeps the three pills on one line.
        style={{ alignSelf: "stretch", marginTop: "auto", borderRadius: theme.radius.pill, paddingHorizontal: spacing.sm }}
      />
    </View>
  );

  return (
    <Pressable
      testID={`tip-tier-${id}`}
      // A plain tap area, not a second button: the pill inside is the tier's one accessible button.
      accessible={false}
      accessibilityRole="none"
      disabled={disabled}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      pressRetentionOffset={12}
      style={stacked ? { flexDirection: "row", alignItems: "flex-end", gap: spacing.lg } : { flex: 1, alignItems: "center", gap: spacing.md }}
    >
      {stage}
      {words}
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
  const connecting = state === "loading";
  const [tapped, setTapped] = useState<TipId | null>(null);
  // Only a product the store priced is buyable. A store that answers with no products, or with products
  // that carry no price text (sideloaded build, items not yet approved), counts as unavailable.
  const prices = new Map(products.filter((p) => p.displayPrice?.trim()).map((p) => [p.id, p.displayPrice]));
  const unavailable = state === "unavailable" || (state === "ready" && prices.size === 0);
  const { width, fontScale } = useWindowDimensions();
  const stacked = fontScale >= STACK_FONT_SCALE || width < STACK_WIDTH;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BeanBackdrop paused={paused} />
      <ScrollView testID="tip-jar-scroll" contentInsetAdjustmentBehavior="never" contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: spacing.lg }}>
          <ScreenHeader title={t("tips.title")} />
          <View style={{ gap: spacing.md }}>
            <Text accessibilityRole="header" style={[theme.type.display, { color: colors.text }]}>
              {t("tips.heading")}
            </Text>
            <Text style={[theme.type.body, { color: colors.text }]}>{t("tips.intro")}</Text>
          </View>

          {connecting ? <ActivityIndicator accessibilityLabel={t("tips.loading")} color={colors.primary} /> : null}

          {unavailable ? (
            <View style={{ gap: spacing.md }}>
              <Text accessibilityLiveRegion="polite" style={[theme.type.body, { color: colors.textMuted }]}>
                {t("tips.unavailable")}
              </Text>
              <Button variant="quiet" label={t("tips.retry")} onPress={retry} style={{ alignSelf: "flex-start" }} />
            </View>
          ) : null}

          {/* The cups always stand on the counter; what changes is whether they carry a price. */}
          <View testID="tip-counter" style={stacked ? { flexDirection: "column", gap: spacing.xl } : { flexDirection: "row", alignItems: "stretch" }}>
            {TIP_IDS.map((id) => (
              <Tier
                key={id}
                id={id}
                price={prices.get(id) ?? null}
                connecting={connecting}
                busy={busy}
                buying={busy && tapped === id}
                stacked={stacked}
                onPress={() => {
                  setTapped(id);
                  buy(id);
                }}
              />
            ))}
          </View>

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
