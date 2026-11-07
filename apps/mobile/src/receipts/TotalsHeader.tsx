import { useMemo } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { deviceTimeZone, formatLocal } from "@/capture/localTime";
import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import { sumHome, type HomeTotal } from "@/db/repositories/receiptQueries";
import { usePref } from "@/prefs/PrefsProvider";
import { taxYearLabel, taxYearOf, taxYearRange } from "@/taxYear/taxYear";
import { useTheme } from "@/theme/ThemeProvider";

import { totalLine } from "./format";

/** "This month" and "Tax year" home-currency totals, by the device's local date. */
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
  const cell = (label: string, tot: HomeTotal) => (
    <View style={{ flex: 1 }}>
      <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
      <Text style={[theme.type.headline, { color: theme.colors.text }]}>
        {totalLine(tot, home, locale, notConverted)}
      </Text>
    </View>
  );
  return (
    <View
      style={{
        flexDirection: "row",
        gap: theme.spacing.lg,
        padding: theme.spacing.lg,
      }}
    >
      {cell(t("totals.thisMonth"), month)}
      {cell(t("totals.taxYear", { label: taxYearLabel(ty, startMonth) }), year)}
    </View>
  );
}
