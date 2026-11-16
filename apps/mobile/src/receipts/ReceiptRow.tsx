import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { Receipt } from "@/db/types";
import { formatMoney } from "@/money/money";
import { useTheme } from "@/theme/ThemeProvider";

import { homeLine } from "./format";

type Props = {
  receipt: Receipt;
  categoryName: string | null;
  categoryColor: string | null;
  home: string;
  locale: string;
  selected: boolean;
  /** First row of its month: no dashed separator above it. */
  first?: boolean;
  onPress(id: string): void;
};

export const ReceiptRow = memo(function ReceiptRow({
  receipt: r,
  categoryName,
  categoryColor,
  home,
  locale,
  selected,
  first = false,
  onPress,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const merchant = r.merchant ?? t("receipts.unknownMerchant");
  const day = r.purchasedAtLocal.slice(8, 10);
  const conv = homeLine(r, home, locale);
  return (
    <Pressable
      testID={`receipt-row-${r.id}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(r.id)}
      style={({ pressed }) => ({
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.lg,
        backgroundColor: pressed
          ? theme.colors.surfacePressed
          : selected
            ? theme.colors.tonal
            : theme.colors.background,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.colors.border,
        borderStyle: "dashed",
      })}
    >
      <Text
        style={[
          theme.type.body,
          { color: theme.colors.textMuted, width: 24, textAlign: "center" },
        ]}
      >
        {day}
      </Text>
      <View style={{ flex: 1, flexShrink: 1 }}>
        <Text
          numberOfLines={1}
          style={[
            theme.type.body,
            { color: theme.colors.text, fontWeight: "600", flexShrink: 1 },
          ]}
        >
          {merchant}
        </Text>
        {categoryName ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: theme.spacing.xs,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: categoryColor ?? theme.colors.textMuted,
              }}
            />
            <Text
              numberOfLines={1}
              style={[theme.type.body, { color: theme.colors.textMuted }]}
            >
              {categoryName}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
        <Text
          numberOfLines={1}
          style={[theme.type.body, theme.type.money, { color: theme.colors.text, flexShrink: 0 }]}
        >
          {formatMoney(r.totalMinor, r.currency, locale)}
        </Text>
        {conv ? (
          <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>
            {conv}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});
