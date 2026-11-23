import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { SlipEdge } from "@/receipts/SlipEdge";
import { useTheme } from "@/theme/ThemeProvider";

/** A decorative drawing: fixed size, centred, never read out by screen readers. */
function Art({ id, children }: { id: string; children: ReactNode }) {
  return (
    <View
      testID={`guide-illustration-${id}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ alignSelf: "center", width: 240, height: 168, alignItems: "center", justifyContent: "center" }}
    >
      {children}
    </View>
  );
}

function Bar({ width, color, height = 8 }: { width: number | `${number}%`; color: string; height?: number }) {
  return <View style={{ width, height, borderRadius: height / 2, backgroundColor: color }} />;
}

/** A paper receipt with the round + button next to it. */
export function ScanIllustration() {
  const { colors, spacing, size } = useTheme();
  return (
    <Art id="scan">
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.lg }}>
        <View
          style={{
            width: 120,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: spacing.lg,
            gap: 7,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
            transform: [{ rotate: "-4deg" }],
          }}
        >
          <Bar width="70%" color={colors.text} />
          <Bar width="45%" color={colors.border} height={6} />
          <View style={{ height: 4 }} />
          <Bar width="90%" color={colors.border} height={6} />
          <Bar width="80%" color={colors.border} height={6} />
          <Bar width="85%" color={colors.border} height={6} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
            <Bar width={30} color={colors.text} />
            <Bar width={40} color={colors.primary} />
          </View>
          <SlipEdge color={colors.background} />
        </View>
        <View
          style={{
            width: size.plus,
            height: size.plus,
            borderRadius: size.plus / 2,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.sm,
          }}
        >
          <Ionicons name="add" size={30} color={colors.onPrimary} />
        </View>
      </View>
    </Art>
  );
}

/** A mini review form; one field carries the "Check this" flag. */
export function ReviewIllustration() {
  const { t } = useTranslation();
  const { colors, type, spacing, radius } = useTheme();
  const field = (w: `${number}%`, flagged = false) => (
    <View style={{ gap: 4 }}>
      <Bar width={w === "100%" ? 54 : 40} color={colors.textMuted} height={5} />
      <View
        style={{
          height: 22,
          borderRadius: radius.sm,
          borderWidth: flagged ? 2 : 1,
          borderColor: flagged ? colors.highlight : colors.border,
          backgroundColor: colors.surface,
          justifyContent: "center",
          paddingHorizontal: 8,
        }}
      >
        <Bar width={w} color={colors.text} height={6} />
      </View>
    </View>
  );
  return (
    <Art id="review">
      <View style={{ width: 200, gap: spacing.sm }}>
        {field("60%")}
        {field("40%", true)}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: -2 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.highlight }} />
          <Text style={[type.caption, { color: colors.text }]} numberOfLines={1}>
            {t("review.checkThis")}
          </Text>
        </View>
        {field("30%")}
      </View>
    </Art>
  );
}

/** The green Home slip with its torn edge and the yellow total bar. */
export function SlipIllustration() {
  const { t } = useTranslation();
  const { colors, type, spacing } = useTheme();
  return (
    <Art id="totals">
      <View style={{ width: 220, backgroundColor: colors.slip, padding: spacing.lg, paddingBottom: spacing.xl, gap: 6 }}>
        <Text style={[type.caption, { color: colors.slipMuted }]} numberOfLines={1}>
          {t("guide.thisMonth")}
        </Text>
        <Bar width="75%" color={colors.slipText} height={16} />
        <Bar width={32} color={colors.highlight} height={4} />
        <View style={{ flexDirection: "row", gap: 4, marginTop: spacing.sm }}>
          <Bar width="45%" color={colors.slipMuted} height={6} />
          <Bar width="25%" color={colors.slipMuted} height={6} />
          <Bar width="15%" color={colors.slipMuted} height={6} />
        </View>
        <SlipEdge color={colors.background} />
      </View>
    </Art>
  );
}
