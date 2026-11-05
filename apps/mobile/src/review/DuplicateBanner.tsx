import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { DuplicateMatch } from "@/capture/duplicates";
import { useDb } from "@/db/DatabaseProvider";
import { getReceipt } from "@/db/repositories/receipts";
import { formatMoney } from "@/money/money";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * "Already saved" (same reference number) or "Possible duplicate" (same photo / same amount,
 * date and merchant). **View** lists the matching saved receipts inline; **Save anyway** saves.
 */
export function DuplicateBanner({
  duplicates,
  onSaveAnyway,
  disabled,
}: {
  duplicates: DuplicateMatch[];
  onSaveAnyway: () => void;
  disabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const db = useDb();
  const [open, setOpen] = useState(false);
  if (!duplicates.length) return null;
  const exact = duplicates.some((d) => d.strength === "exact-ref");

  const button = (label: string, onPress: () => void, primary = false) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={{
        minHeight: 44,
        paddingHorizontal: theme.spacing.lg,
        justifyContent: "center",
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: primary ? theme.colors.warning : theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Text style={[theme.type.body, { color: theme.colors.text, fontWeight: "600" }]}>{label}</Text>
    </Pressable>
  );

  const money = (minor: number, code: string) => {
    try {
      return formatMoney(minor, code, i18n.language);
    } catch {
      return code;
    }
  };

  return (
    <View
      accessibilityRole="alert"
      style={{
        gap: theme.spacing.sm,
        padding: theme.spacing.lg,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.warning,
        backgroundColor: theme.colors.background,
      }}
    >
      <Text style={[theme.type.body, { color: theme.colors.text, fontWeight: "700" }]}>
        {t(exact ? "review.duplicateExact" : "review.duplicatePossible")}
      </Text>
      <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>
        {t(exact ? "review.duplicateExactHint" : "review.duplicatePossibleHint")}
      </Text>
      {open
        ? duplicates.map((d) => {
            const r = getReceipt(db, d.receiptId);
            if (!r) return null;
            return (
              <Text key={d.receiptId} style={[theme.type.body, { color: theme.colors.text }]}>
                {[r.merchant ?? "—", r.purchasedAtLocal.slice(0, 10), money(r.totalMinor, r.currency)].join(" · ")}
              </Text>
            );
          })
        : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        {button(t(open ? "review.hide" : "review.view"), () => setOpen((o) => !o))}
        {button(t("review.saveAnyway"), onSaveAnyway, true)}
      </View>
    </View>
  );
}
