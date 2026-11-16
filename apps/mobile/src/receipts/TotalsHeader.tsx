import { useMemo } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { deviceTimeZone, formatLocal } from "@/capture/localTime";
import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import { sumHome, type HomeTotal } from "@/db/repositories/receiptQueries";
import { usePref } from "@/prefs/PrefsProvider";
import { taxYearLabel, taxYearOf, taxYearRange } from "@/taxYear/taxYear";
import { FONTS } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";

import { totalLine } from "./format";
import { slipAmountText } from "./slipAmount";
import { SlipEdge } from "./SlipEdge";

/** Leading currency ("Rp", "$", "R$") and the rest; null when the currency is not in front. */
function splitPrefix(text: string): [string, string, string] | null {
  const m = /^([^\d\s-]+)(\s*)(.*\d.*)$/.exec(text);
  return m ? [m[1], m[2], m[3]] : null;
}

/**
 * The Ledger slip: "This month" and "Tax year" home-currency totals, by the device's local date,
 * on a green till slip with a torn bottom edge.
 */
export function TotalsHeader() {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language || "en";
  const theme = useTheme();
  const db = useDb();
  const home = usePref("homeCurrency") ?? "USD";
  const startMonth = usePref("taxYearStartMonth") ?? 1;
  const version = useDataVersion();
  const today = formatLocal(new Date(), deviceTimeZone()).slice(0, 10);
  const ty = taxYearOf(today, startMonth);
  const { month, year } = useMemo(() => {
    const [y, m] = today.split("-").map(Number);
    const first = `${today.slice(0, 7)}-01`;
    const last = `${today.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
    return {
      month: sumHome(db, { from: first, to: last }, home),
      year: sumHome(db, taxYearRange(ty, startMonth), home),
    };
    // version: re-read after any receipt write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, home, today, ty, startMonth]);

  const notConverted = (n: number) => t("totals.notConverted", { count: n });
  const { colors, type, spacing } = theme;
  const cell = (key: string, label: string, tot: HomeTotal, totalBar: boolean) => {
    const amount = slipAmountText(tot.homeMinor, home, locale);
    const parts = splitPrefix(amount.text);
    return (
      // One stop for screen readers: the label and the exact total, even when the slip shows the compact form.
      <View
        testID={`slip-cell-${key}`}
        accessible
        accessibilityLabel={`${label}, ${totalLine(tot, home, locale, notConverted)}`}
        style={{ flex: 1, minWidth: 0 }}
      >
        <Text style={[type.body, { color: colors.slipMuted }]}>{label}</Text>
        <Text
          testID={`slip-amount-${key}`}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[type.display, type.money, { color: colors.slipText }]}
        >
          {parts ? (
            <>
              <Text style={{ fontFamily: FONTS.bold, fontSize: 18, color: colors.slipMuted }}>{parts[0]}</Text>
              {parts[1]}
              {parts[2]}
            </>
          ) : (
            amount.text
          )}
        </Text>
        {totalBar ? (
          <View
            testID="slip-total-bar"
            style={{ height: 4, width: spacing.xxl, borderRadius: 2, marginTop: spacing.xs, backgroundColor: colors.highlight }}
          />
        ) : null}
        {tot.unconverted > 0 ? (
          <Text style={[type.caption, { color: colors.slipMuted, marginTop: spacing.xs }]}>{notConverted(tot.unconverted)}</Text>
        ) : null}
      </View>
    );
  };
  return (
    <View
      testID="totals-slip"
      style={{
        backgroundColor: colors.slip,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xl,
        marginBottom: spacing.md,
      }}
    >
      <View style={{ flexDirection: "row", gap: spacing.lg }}>
        {cell("month", t("totals.thisMonth"), month, true)}
        {cell("year", t("totals.taxYear", { label: taxYearLabel(ty, startMonth) }), year, false)}
      </View>
      <SlipEdge color={colors.background} />
    </View>
  );
}
