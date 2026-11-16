import { useMemo } from "react";
import { SectionList, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import { listCategories } from "@/db/repositories/categories";
import type { ReceiptFilter } from "@/db/repositories/receiptQueries";
import type { Receipt } from "@/db/types";
import { useTabBarSpace } from "@/layout/useTabBarSpace";
import { usePref } from "@/prefs/PrefsProvider";
import { categoryLabel } from "@/review/ReviewFields";
import { useTheme } from "@/theme/ThemeProvider";

import { monthLabel, totalLine } from "./format";
import { ReceiptRow } from "./ReceiptRow";
import { useReceiptQuery } from "./useReceiptQuery";

type Props = {
  filter: ReceiptFilter;
  selectedId?: string | null;
  onSelect(id: string): void;
  ListHeaderComponent?: React.ReactElement | null;
  empty: React.ReactElement;
};

export function ReceiptList({
  filter,
  selectedId,
  onSelect,
  ListHeaderComponent,
  empty,
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language || "en";
  const theme = useTheme();
  const db = useDb();
  const home = usePref("homeCurrency") ?? "USD";
  const version = useDataVersion();
  const tabBarSpace = useTabBarSpace();
  const { rows, months, loadMore } = useReceiptQuery(filter);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cats = useMemo(() => listCategories(db), [db, version]);
  const catById = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  const sections = useMemo(() => {
    const out: { month: string; data: Receipt[] }[] = [];
    for (const r of rows) {
      const m = r.purchasedAtLocal.slice(0, 7);
      const last = out[out.length - 1];
      if (last && last.month === m) last.data.push(r);
      else out.push({ month: m, data: [r] });
    }
    return out;
  }, [rows]);

  const notConverted = (n: number) => t("totals.notConverted", { count: n });

  return (
    <SectionList
      sections={sections}
      keyExtractor={(r) => r.id}
      stickySectionHeadersEnabled={false}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={ListHeaderComponent ?? undefined}
      ListEmptyComponent={empty}
      // 96 clears the wide-layout FAB; compact clears the floating tab bar.
      contentContainerStyle={{ paddingBottom: Math.max(96, tabBarSpace), flexGrow: 1 }}
      style={{ backgroundColor: theme.colors.background }}
      renderSectionHeader={({ section }) => {
        const mt = months[section.month];
        return (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.sm,
              backgroundColor: theme.colors.background,
            }}
          >
            <Text
              accessibilityRole="header"
              style={[
                theme.type.body,
                { color: theme.colors.text, fontWeight: "700", flexShrink: 1 },
              ]}
            >
              {monthLabel(section.month, locale)}
            </Text>
            {mt ? (
              <Text
                testID={`month-total-${section.month}`}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                style={[theme.type.body, { color: theme.colors.textMuted }]}
              >
                {totalLine(mt, home, locale, notConverted)}
              </Text>
            ) : null}
          </View>
        );
      }}
      renderItem={({ item, index }) => {
        const c = item.categoryId ? catById.get(item.categoryId) : undefined;
        return (
          <ReceiptRow
            receipt={item}
            categoryName={c ? categoryLabel(c, t) : null}
            categoryColor={c?.color ?? null}
            home={home}
            locale={locale}
            selected={item.id === selectedId}
            first={index === 0}
            onPress={onSelect}
          />
        );
      }}
    />
  );
}
