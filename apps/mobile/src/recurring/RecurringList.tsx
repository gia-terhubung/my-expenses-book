import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { deviceTimeZone } from "@/capture/localTime";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { now } from "@/dates/clock";
import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import type { RecurringRule } from "@/db/types";
import { EmptyState } from "@/layout/EmptyState";
import { formatMoney } from "@/money/money";
import { usePref } from "@/prefs/PrefsProvider";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useTheme } from "@/theme/ThemeProvider";
import type { ColorTokens } from "@/theme/tokens";

import { monthlyEquivalent, ruleSubtitle } from "./format";
import { todayIn } from "./occurrences";
import { listRules } from "./rules";

/**
 * Colours of the list's quiet text, on the row/page colours they sit on (checked by the contrast
 * test): the "~" estimate prefix and the subtitles are muted on a row, the total is muted on the page.
 */
export const RECURRING_LIST_TEXT: [keyof ColorTokens, keyof ColorTokens][] = [
  ["textMuted", "surface"],
  ["textMuted", "tonal"],
  ["textMuted", "background"],
  ["text", "surface"],
  ["text", "tonal"],
];

function money(minor: number, code: string, locale: string): string {
  try {
    return formatMoney(minor, code, locale);
  } catch {
    return code;
  }
}

type Props = {
  selectedId: string | null;
  onSelect(id: string): void;
  onNew(): void;
  onBack?: () => void;
};

/**
 * Settings > Recurring: every rule with its amount and next date, and what they cost in an
 * average month. Draft-type rules (Add automatically off) show their amount as an estimate ("~").
 */
export function RecurringList({ selectedId, onSelect, onNew, onBack }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language || "en";
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const fx = usePref("fxTables");
  const home = usePref("homeCurrency") ?? "USD";
  const version = useDataVersion();

  const { rules, total, today } = useMemo(() => {
    const day = todayIn(deviceTimeZone(), now());
    const list = listRules(db);
    return { rules: list, today: day, total: monthlyEquivalent(list, home, fx, day) };
    // version: re-read after any write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, home, fx, version]);

  const header = (
    <ScreenHeader
      title={t("recurring.title")}
      onBack={onBack ?? null}
      actions={
        rules.length > 0 ? (
          <Button testID="recurring-new" label={t("recurring.new")} accessibilityLabel={t("recurring.newTitle")} onPress={onNew} />
        ) : null
      }
    />
  );

  if (rules.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg }}>{header}</View>
        <EmptyState title={t("recurring.emptyTitle")} message={t("recurring.emptyMessage")} topInset={false}>
          <Button testID="recurring-empty-new" variant="primary" label={t("recurring.emptyAction")} onPress={onNew} style={{ alignSelf: "flex-start" }} />
        </EmptyState>
      </View>
    );
  }

  return (
    <ScrollView
      testID="recurring-list"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.lg, gap: theme.spacing.sm }}
    >
      <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: theme.spacing.sm }}>
        {header}
        <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
          <Text testID="recurring-total" style={[theme.type.body, theme.type.money, { color: theme.colors.text }]}>
            {t("recurring.monthlyTotal", { amount: money(total.homeMinor, home, locale) })}
          </Text>
          {total.skipped > 0 ? (
            <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>{t("recurring.fxMissing")}</Text>
          ) : null}
        </View>
        {rules.map((rule) => (
          <RuleRow key={rule.id} rule={rule} today={today} locale={locale} selected={rule.id === selectedId} onPress={() => onSelect(rule.id)} />
        ))}
      </View>
    </ScrollView>
  );
}

function RuleRow({
  rule,
  today,
  locale,
  selected,
  onPress,
}: {
  rule: RecurringRule;
  today: string;
  locale: string;
  selected: boolean;
  onPress(): void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const merchant = rule.merchant ?? t("recurring.notifyUnnamed");
  const amount = money(rule.totalMinor, rule.currency, locale);
  const subtitle = ruleSubtitle(rule, today, locale, t);
  const estimate = !rule.autoAdd;
  return (
    <Card
      testID={`recurring-row-${rule.id}`}
      selected={selected}
      onPress={onPress}
      accessibilityLabel={[merchant, estimate ? t("recurring.estimate", { amount }) : amount, subtitle].join(", ")}
    >
      <View style={{ flex: 1, flexShrink: 1 }}>
        <Text numberOfLines={1} style={[theme.type.body, { color: theme.colors.text, fontWeight: "600" }]}>
          {merchant}
        </Text>
        <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{subtitle}</Text>
      </View>
      <Text numberOfLines={1} style={[theme.type.body, theme.type.money, { color: theme.colors.text, flexShrink: 0 }]}>
        {estimate ? <Text style={{ color: theme.colors.textMuted }}>{"~ "}</Text> : null}
        {amount}
      </Text>
    </Card>
  );
}
