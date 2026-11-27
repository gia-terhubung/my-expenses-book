import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import { useTranslation } from "react-i18next";

import { deviceTimeZone, formatLocal } from "@/capture/localTime";
import { now } from "@/dates/clock";
import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import { listCategories } from "@/db/repositories/categories";
import { sumHome, totalsByCategory, type HomeTotal } from "@/db/repositories/receiptQueries";
import { useLayout } from "@/layout/useLayout";
import { categoryLabel } from "@/organize/categoryLabel";
import { payPeriodOf } from "@/stats/payPeriod";
import { categoryStrip, pacePercent, pacePeriods } from "@/stats/stats";
import { usePref } from "@/prefs/PrefsProvider";
import { taxYearLabel, taxYearOf, taxYearRange } from "@/taxYear/taxYear";
import { FONTS } from "@/theme/fonts";
import { useTheme } from "@/theme/ThemeProvider";

import { totalLine } from "./format";
import { slipAmountText } from "./slipAmount";
import { useContentInsets } from "@/layout/navContext";

import { SlipEdge } from "./SlipEdge";

// Building Intl formatters is slow on Hermes; the slip re-renders on every data change.
const monthNames = new Map<string, Intl.DateTimeFormat>();
function monthNameFormat(locale: string): Intl.DateTimeFormat {
  let fmt = monthNames.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
    monthNames.set(locale, fmt);
  }
  return fmt;
}

/** Leading currency ("Rp", "$", "R$") and the rest; null when the currency is not in front. */
function splitPrefix(text: string): [string, string, string] | null {
  const m = /^([^\d\s-]+)(\s*)(.*\d.*)$/.exec(text);
  return m ? [m[1], m[2], m[3]] : null;
}

/**
 * The Ledger slip: "This month" and "Tax year" home-currency totals, by the device's local date,
 * on a green till slip with a torn bottom edge. In a short window (height < 480, the closed Duo
 * sideways) it is one row: "This month" and "See statistics ›".
 */
export function TotalsHeader() {
  const side = useContentInsets();
  const { t, i18n } = useTranslation();
  const locale = i18n?.language || "en";
  const theme = useTheme();
  const { short } = useLayout();
  const db = useDb();
  const home = usePref("homeCurrency") ?? "USD";
  const startMonth = usePref("taxYearStartMonth") ?? 1;
  const startDay = usePref("monthStartDay") ?? 1;
  const version = useDataVersion();
  const today = formatLocal(now(), deviceTimeZone()).slice(0, 10);
  const ty = taxYearOf(today, startMonth);
  const { month, year, stats } = useMemo(() => {
    const period = payPeriodOf(today, startDay);
    const pace = pacePeriods(today, startDay);
    const categories = new Map(listCategories(db).map((c) => [c.id, c]));
    const strip = categoryStrip(totalsByCategory(db, period, home)).map((s) => ({
      ...s,
      category: s.categoryId ? (categories.get(s.categoryId) ?? null) : null,
    }));
    return {
      month: sumHome(db, period, home),
      year: sumHome(db, taxYearRange(ty, startMonth), home),
      stats: {
        pace,
        paceNow: sumHome(db, pace.current, home).homeMinor,
        pacePrev: sumHome(db, pace.previous, home).homeMinor,
        strip,
        unconverted: sumHome(db, {}, home).unconverted,
      },
    };
    // version: re-read after any receipt write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, home, today, ty, startMonth, startDay]);

  const notConverted = (n: number) => t("totals.notConverted", { count: n });
  const { colors, type, spacing } = theme;
  const statsText = { numberOfLines: 2, adjustsFontSizeToFit: true, minimumFontScale: 0.8, maxFontSizeMultiplier: 1.3 } as const;
  // Short slip: the money cell outranks the stats column (3:2 from a zero basis), so a long total is
  // squeezed last; money is never ellipsized or wrapped.
  const cell = (key: string, label: string, tot: HomeTotal, totalBar: boolean) => {
    const amount = slipAmountText(tot.homeMinor, home, locale);
    const parts = splitPrefix(amount.text);
    return (
      // Not a separate screen-reader stop: the slip button's label carries the label and the exact total.
      <View testID={`slip-cell-${key}`} style={short ? { flexGrow: 3, flexBasis: 0, flexShrink: 1, minWidth: 0 } : { flex: 1, minWidth: 0 }}>
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
      </View>
    );
  };
  const pct = pacePercent(stats.paceNow, stats.pacePrev);
  const arrow = pct === null ? "" : pct > 0 ? "▲" : pct < 0 ? "▼" : "=";
  const paceHead = pct === null ? "" : `${arrow} ${Math.abs(pct)}%`;
  const paceText =
    pct === null
      ? ""
      : t("stats.paceSlip", {
          arrow,
          pct: Math.abs(pct),
          period: monthNameFormat(locale).format(
            Date.UTC(Number(stats.pace.previousMonth.slice(0, 4)), Number(stats.pace.previousMonth.slice(5, 7)) - 1, 1),
          ),
          day: String(Number(stats.pace.previous.to.slice(8, 10))),
        });
  const segmentOpacity = [1, 0.8, 0.6, 0.35];
  const segments = stats.strip.map((s, i) => ({
    key: s.categoryId ?? "none",
    flex: s.share,
    opacity: segmentOpacity[Math.min(i, segmentOpacity.length - 1)],
    name: s.categoryId === "rest" ? t("categories.other") : s.category ? categoryLabel(s.category, t) : t("stats.uncategorized"),
    pct: `${Math.round(s.share * 100)}%`,
  }));
  const slipLabel = [
    t("totals.thisMonth") + ", " + totalLine(month, home, locale, notConverted),
    t("totals.taxYear", { label: taxYearLabel(ty, startMonth) }) + ", " + totalLine(year, home, locale, notConverted),
    paceText,
    segments.map((s) => `${s.name} ${s.pct}`).join(", "),
    stats.unconverted > 0 ? notConverted(stats.unconverted) : "",
    t("stats.openStats"),
  ]
    .filter(Boolean)
    .join(". ");
  return (
    <Pressable
      testID="totals-slip"
      accessibilityRole="button"
      accessibilityLabel={slipLabel}
      onPress={() => router.push("/stats" as Href)}
      style={({ pressed }) => ({
        backgroundColor: colors.slip,
        // Bleeds under the iPhone Duo side column; the text keeps its gutter.
        marginLeft: -side.left,
        marginRight: -side.right,
        paddingLeft: spacing.lg + side.left,
        paddingRight: spacing.lg + side.right,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xl,
        marginBottom: spacing.md,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{ flexDirection: "row", gap: spacing.lg }}>
        {cell("month", t("totals.thisMonth"), month, true)}
        {short ? (
          <View testID="slip-short-stats" style={{ alignItems: "flex-end", justifyContent: "flex-end", flexGrow: 2, flexBasis: 0, flexShrink: 1, minWidth: 0, gap: spacing.xs }}>
            {stats.unconverted > 0 ? (
              <Text {...statsText} style={[type.body, { color: colors.slipText, textAlign: "right" }]}>
                {notConverted(stats.unconverted)}
              </Text>
            ) : null}
            <Text {...statsText} style={[type.body, { color: colors.highlight, fontFamily: FONTS.bold, textAlign: "right" }]}>{`${t("stats.openStats")} ›`}</Text>
          </View>
        ) : (
          cell("year", t("totals.taxYear", { label: taxYearLabel(ty, startMonth) }), year, false)
        )}
      </View>
      {short ? null : pct !== null ? (
        <Text testID="slip-pace" style={[type.body, { color: colors.slipMuted, marginTop: spacing.sm }]}>
          <Text testID="slip-pace-pct" style={{ color: colors.highlight, fontFamily: FONTS.bold }}>
            {paceHead}
          </Text>
          {paceText.startsWith(paceHead) ? paceText.slice(paceHead.length) : ` ${paceText}`}
        </Text>
      ) : null}
      {!short && segments.length > 0 ? (
        <>
          <View
            style={{ flexDirection: "row", gap: 2, height: 8, borderRadius: 4, overflow: "hidden", marginTop: spacing.md }}
          >
            {segments.map((s, i) => (
              <View
                key={s.key}
                testID={`slip-strip-seg-${i}`}
                style={{ flex: s.flex, minWidth: 3, backgroundColor: colors.slipText, opacity: s.opacity }}
              />
            ))}
          </View>
          <View
            testID="slip-legend"
            style={{ flexDirection: "row", flexWrap: "wrap", columnGap: spacing.lg, rowGap: 2, marginTop: spacing.sm }}
          >
            {segments.map((s) => (
              <View key={s.key} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: colors.slipText, opacity: s.opacity }} />
                <Text style={[type.caption, { color: colors.slipText }]}>{s.name}</Text>
                <Text style={[type.caption, { color: colors.slipMuted }]}>{s.pct}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
      {short ? null : (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: spacing.md,
            marginTop: spacing.md,
            minHeight: 44,
            borderTopWidth: 1,
            borderStyle: "dashed",
            borderColor: colors.slipMuted,
          }}
        >
          {/* The only visible "not converted" note on the slip (owner, check-in 4); totals keep it in their labels. */}
          {stats.unconverted > 0 ? (
            <Text style={[type.body, { color: colors.slipText, flexShrink: 1 }]}>{notConverted(stats.unconverted)}</Text>
          ) : null}
          <Text style={[type.body, { color: colors.highlight, fontFamily: FONTS.bold, marginLeft: "auto" }]}>{`${t("stats.openStats")} ›`}</Text>
        </View>
      )}
      <SlipEdge color={colors.background} />
    </Pressable>
  );
}
