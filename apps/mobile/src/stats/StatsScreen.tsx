import { router, type Href } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { deviceTimeZone, formatLocal } from "@/capture/localTime";
import { useAddReceipt } from "@/capture/useAddReceipt";
import { Button } from "@/components/Button";
import { now as clockNow } from "@/dates/clock";
import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import { listCategories } from "@/db/repositories/categories";
import { listFolders } from "@/db/repositories/folders";
import {
  monthTotals,
  periodTotals,
  sumHome,
  topMerchants,
  totalsByCategory,
  totalsByFolder,
} from "@/db/repositories/receiptQueries";
import { StatusBarInset } from "@/layout/StatusBarInset";
import { formatMoney } from "@/money/money";
import { categoryLabel } from "@/organize/categoryLabel";
import { usePref } from "@/prefs/PrefsProvider";
import { monthLabel } from "@/receipts/format";
import { slipAmountText } from "@/receipts/slipAmount";
import { taxYearLabel, taxYearOf, taxYearRange } from "@/taxYear/taxYear";
import { ScreenHeader } from "@/components/ScreenHeader";
import { InfoButton } from "@/guide/InfoButton";
import { useTheme } from "@/theme/ThemeProvider";

import { compactAmount, currencySymbol } from "./compactAmount";
import { MonthBars, type MonthBar } from "./MonthBars";
import { lastPayPeriods, payPeriodOf } from "./payPeriod";
import { pacePercent, pacePeriods, taxYearMonths, taxYearPacePeriods } from "./stats";

type Mode = "month" | "taxYear";

const dateFormats = new Map<string, Intl.DateTimeFormat>();
/** Locale month/day parts of a "YYYY-MM-DD" (UTC so the device zone never shifts the day). */
function formatDate(local: string, locale: string, opts: Intl.DateTimeFormatOptions): string {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let fmt = dateFormats.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" });
    dateFormats.set(key, fmt);
  }
  const [y, m, d] = local.split("-").map(Number);
  return fmt.format(Date.UTC(y, m - 1, d || 1));
}

/** Compact amount without the currency symbol, for the narrow 12-month columns ("31,3 jt"). */
function bareCompact(minor: number, currency: string, locale: string): string {
  return compactAmount(minor, currency, locale).replace(currencySymbol(locale, currency), "").trim();
}

/**
 * Statistik: on-device spending for this month or the current tax year, in home currency.
 * Totals count converted receipts only; the rest are counted in the "not converted" card.
 */
export function StatsScreen({ now = clockNow }: { now?: () => Date }) {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language || "en";
  const theme = useTheme();
  const { colors, type, spacing, radius, size } = theme;
  const insets = useSafeAreaInsets();
  const db = useDb();
  const version = useDataVersion();
  const home = usePref("homeCurrency") ?? "USD";
  const startMonth = usePref("taxYearStartMonth") ?? 1;
  const startDay = usePref("monthStartDay") ?? 1;
  const today = formatLocal(now(), deviceTimeZone()).slice(0, 10);
  const [mode, setMode] = useState<Mode>("month");
  const add = useAddReceipt();

  const data = useMemo(() => {
    const ty = taxYearOf(today, startMonth);
    const periods = mode === "month" ? lastPayPeriods(today, 6, startDay) : [];
    const months = mode === "month" ? periods.map((p) => p.label) : taxYearMonths(ty, startMonth);
    const period = mode === "month" ? payPeriodOf(today, startDay) : taxYearRange(ty, startMonth);
    const pace = mode === "month" ? pacePeriods(today, startDay) : taxYearPacePeriods(today, startMonth);
    const paceNow = sumHome(db, pace.current, home).homeMinor;
    const pacePrev = sumHome(db, pace.previous, home).homeMinor;
    const categories = new Map(listCategories(db).map((c) => [c.id, c]));
    const folders = new Map(listFolders(db).map((f) => [f.id, f]));
    const allTime = sumHome(db, {}, home);
    return {
      ty,
      months,
      pace,
      period,
      paceNow,
      pacePrev,
      any: allTime.count > 0,
      total: sumHome(db, period, home),
      // All time, like the Search filter "See receipts" opens, so the card and Search agree.
      unconverted: allTime.unconverted,
      byMonth:
        mode === "month"
          ? periodTotals(db, periods, home)
          : monthTotals(db, { from: `${months[0]}-01`, to: `${months[months.length - 1]}-31` }, home),
      // Rows with nothing converted have no share of the total; the unconverted card counts them.
      categories: totalsByCategory(db, period, home)
        .filter((r) => r.total.homeMinor > 0)
        .map((r) => ({ ...r, category: r.categoryId ? (categories.get(r.categoryId) ?? null) : null })),
      merchants: topMerchants(db, period, home, 5),
      folders: totalsByFolder(db, period, home).flatMap((r) => {
        const folder = folders.get(r.folderId);
        return folder ? [{ ...r, folder }] : [];
      }),
    };
    // version: re-read after any receipt write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version, home, today, mode, startMonth, startDay]);

  const money = (minor: number) => formatMoney(minor, home, locale);
  const muted = { color: colors.textMuted };
  const small = { fontSize: 14, lineHeight: 20 };
  const dayNum = String(Number(today.slice(8, 10)));
  const curMonth = mode === "month" ? payPeriodOf(today, startDay).label : today.slice(0, 7);

  // Day first ("25 Oct") in every locale, including English, which would otherwise print "Oct 25".
  const rangeDate = (d: string) => formatDate(d, locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short" });
  const shortDate = (d: string) => formatDate(d, locale, { day: "numeric", month: "short" });

  const periodLabel = mode === "month" ? monthLabel(curMonth, locale) : t("totals.taxYear", { label: taxYearLabel(data.ty, startMonth) });
  const runningDay = mode === "month" ? dayNum : shortDate(today);
  const pct = pacePercent(data.paceNow, data.pacePrev);
  const arrow = pct === null ? "" : pct > 0 ? "▲" : pct < 0 ? "▼" : "=";
  const paceHead = pct === null ? "" : `${arrow} ${Math.abs(pct)}%`;
  const paceText =
    pct === null
      ? ""
      : mode === "month"
        ? t("stats.pace", {
            arrow,
            pct: Math.abs(pct),
            period: formatDate(`${data.pace.previousMonth}-01`, locale, { month: "long" }),
            day: String(Number(data.pace.previous.to.slice(8, 10))),
          })
        : t("stats.paceDate", {
            arrow,
            pct: Math.abs(pct),
            period: taxYearLabel(data.ty - 1, startMonth),
            date: shortDate(data.pace.previous.to),
          });
  const amount = slipAmountText(data.total.homeMinor, home, locale);

  const bars: MonthBar[] = data.months.map((m) => {
    const minor = data.byMonth[m]?.homeMinor ?? 0;
    return {
      month: m,
      label: formatDate(`${m}-01`, locale, { month: "short" }),
      minor,
      value: minor > 0 ? (mode === "month" ? compactAmount(minor, home, locale) : bareCompact(minor, home, locale)) : mode === "month" ? "–" : " ",
      accessibilityLabel: `${monthLabel(m, locale)}, ${money(minor)}`,
      current: m === curMonth,
      gapAtMinor: mode === "month" && m === data.pace.previousMonth ? data.pacePrev : undefined,
    };
  });

  const section = (title: string) => (
    <Text accessibilityRole="header" style={[type.title, { fontSize: 18, lineHeight: 24, color: colors.text, marginTop: 28, marginBottom: spacing.sm }]}>
      {title}
    </Text>
  );
  const row = (key: string, children: ReactNode, first: boolean, label: string) => (
    <View
      key={key}
      accessible
      accessibilityLabel={label}
      style={{
        minHeight: size.touch,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border,
        borderStyle: "dashed",
      }}
    >
      {children}
    </View>
  );
  const amountText = (minor: number) => (
    <Text numberOfLines={1} style={[type.body, type.money, { color: colors.text, fontWeight: "600", flexShrink: 0 }]}>
      {money(minor)}
    </Text>
  );
  const nameBlock = (name: string, sub: string) => (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={[type.body, { color: colors.text }]}>
        {name}
      </Text>
      <Text numberOfLines={1} style={[small, muted]}>
        {sub}
      </Text>
    </View>
  );

  const catMax = data.categories[0]?.total.homeMinor ?? 0;
  const share = (minor: number) => {
    const p = (minor / data.total.homeMinor) * 100;
    return p < 0.5 ? "<1%" : `${Math.round(p)}%`;
  };

  const tab = (m: Mode, label: string) => {
    const on = mode === m;
    return (
      <Pressable
        key={m}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: on }}
        onPress={() => setMode(m)}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: size.touch,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.md,
          borderCurve: "continuous",
          backgroundColor: on ? colors.surface : pressed ? colors.tonalPressed : "transparent",
          borderWidth: 1,
          borderColor: on ? colors.border : "transparent",
        })}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={[type.body, { alignSelf: "stretch", textAlign: "center", color: on ? colors.primary : colors.textMuted, fontWeight: on ? "600" : "500" }]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <StatusBarInset>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
      >
        <View style={{ width: "100%", maxWidth: 560, alignSelf: "center" }}>
          <ScreenHeader title={t("stats.title")} />

          {!data.any ? (
            <View style={{ marginTop: spacing.xl, gap: spacing.lg, alignItems: "flex-start" }}>
              <Text style={[type.body, muted]}>{t("stats.empty")}</Text>
              <Button variant="primary" label={t("capture.scan")} onPress={() => void add.start("scan")} />
            </View>
          ) : (
            <>
              <View
                accessibilityRole="tablist"
                style={{
                  flexDirection: "row",
                  gap: spacing.xs,
                  padding: spacing.xs,
                  marginTop: 10,
                  borderRadius: spacing.lg,
                  borderCurve: "continuous",
                  backgroundColor: colors.tonal,
                }}
              >
                {tab("month", t("stats.month"))}
                {tab("taxYear", t("stats.taxYear"))}
              </View>

              <View style={{ marginTop: 20 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: spacing.sm }}>
                  <Text style={[type.label, { color: colors.text }]}>{periodLabel}</Text>
                  <Text style={[small, muted]}>{t("stats.running", { day: runningDay })}</Text>
                </View>
                {mode === "month" && startDay !== 1 ? (
                  <Text testID="stats-range" style={[small, muted]}>
                    {`${rangeDate(data.period.from)} – ${rangeDate(data.period.to)}`}
                  </Text>
                ) : null}
                <Text
                  testID="stats-total"
                  accessibilityLabel={amount.exact}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                  style={[type.display, type.money, { color: colors.text, marginTop: 2 }]}
                >
                  {amount.text}
                </Text>
                {pct !== null ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text testID="stats-pace" style={[small, muted, { marginTop: 2 }]}>
                        {paceText.startsWith(paceHead) ? (
                          <>
                            <Text style={{ color: colors.text, fontWeight: "700" }}>{paceHead}</Text>
                            {paceText.slice(paceHead.length)}
                          </>
                        ) : (
                          paceText
                        )}{" "}
                        ({money(data.pacePrev)})
                      </Text>
                    </View>
                    <InfoButton topic="pace" />
                  </View>
                ) : null}
                <Text testID="stats-count" style={[small, muted]}>
                  {t("stats.receiptCount", { count: data.total.count })}
                </Text>
              </View>

              {section(mode === "month" ? t("stats.lastMonths") : t("stats.byMonth"))}
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.control,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 14,
                  paddingTop: 14,
                  paddingBottom: spacing.md,
                }}
              >
                <MonthBars bars={bars} dense={mode === "taxYear"} />
              </View>

              {data.categories.length > 0 ? (
                <>
                  {section(t("stats.categories"))}
                  {data.categories.map((r, i) => {
                    const name = r.category ? categoryLabel(r.category, t) : t("stats.uncategorized");
                    const pctText = share(r.total.homeMinor);
                    return (
                      <View
                        key={r.categoryId ?? "none"}
                        accessible
                        accessibilityLabel={`${name}, ${money(r.total.homeMinor)}, ${pctText}`}
                        style={{
                          minHeight: size.touch,
                          justifyContent: "center",
                          gap: 7,
                          paddingTop: 9,
                          paddingBottom: 11,
                          borderTopWidth: i === 0 ? 0 : 1,
                          borderTopColor: colors.border,
                          borderStyle: "dashed",
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: r.category?.color ?? colors.textMuted }} />
                            <Text numberOfLines={1} style={[type.body, { color: colors.text, flexShrink: 1 }]}>
                              {name}
                            </Text>
                          </View>
                          {amountText(r.total.homeMinor)}
                          <Text numberOfLines={1} style={[small, type.money, muted, { minWidth: 38, textAlign: "right", flexShrink: 0 }]}>
                            {pctText}
                          </Text>
                        </View>
                        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.tonal, overflow: "hidden" }}>
                          <View
                            style={{
                              height: 6,
                              borderRadius: 3,
                              width: `${Math.max(1.5, (r.total.homeMinor / catMax) * 100)}%`,
                              backgroundColor: colors.primary,
                            }}
                          />
                        </View>
                      </View>
                    );
                  })}
                </>
              ) : null}

              {data.merchants.length > 0 ? (
                <>
                  {section(t("stats.merchants"))}
                  {data.merchants.map((r, i) => {
                    const name = r.merchant ?? t("receipts.unknownMerchant");
                    const count = t("folders.receiptCount", { count: r.total.count });
                    return row(
                      `${i}`,
                      <>
                        <Text style={[type.body, type.money, muted, { minWidth: 30, textAlign: "center", flexShrink: 0 }]}>{i + 1}</Text>
                        {nameBlock(name, count)}
                        {amountText(r.total.homeMinor)}
                      </>,
                      i === 0,
                      `${i + 1}. ${name}, ${count}, ${money(r.total.homeMinor)}`,
                    );
                  })}
                </>
              ) : null}

              {data.folders.length > 0 ? (
                <>
                  {section(t("stats.folders"))}
                  {data.folders.map((r, i) => {
                    const sub = `${t(r.folder.kind === "trip" ? "folders.kindTrip" : "folders.kindProject")}, ${t("folders.receiptCount", { count: r.total.count })}`;
                    return row(
                      r.folderId,
                      <>
                        {nameBlock(r.folder.name, sub)}
                        {amountText(r.total.homeMinor)}
                      </>,
                      i === 0,
                      `${r.folder.name}, ${sub}, ${money(r.total.homeMinor)}`,
                    );
                  })}
                </>
              ) : null}

              {data.unconverted > 0 ? (
                <>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                    {section(t("stats.unconverted"))}
                    <InfoButton topic="unconverted" />
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 14,
                      paddingTop: 14,
                      paddingRight: 14,
                      paddingBottom: spacing.xs,
                      paddingLeft: 18,
                      borderRadius: radius.control,
                      borderCurve: "continuous",
                      backgroundColor: colors.brassFill,
                      boxShadow: `inset 0 0 0 1px ${colors.brassRing}`,
                    }}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: colors.warning }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[type.label, { color: colors.warning }]}>
                        {t("stats.unconvertedBody", { count: data.unconverted })}
                      </Text>
                      <Button
                        variant="quiet"
                        label={t("stats.seeReceipts")}
                        onPress={() => router.navigate({ pathname: "/search", params: { unconverted: "1" } } as unknown as Href)}
                        style={{ alignSelf: "flex-start", marginTop: spacing.sm }}
                      />
                    </View>
                  </View>
                </>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </StatusBarInset>
  );
}
