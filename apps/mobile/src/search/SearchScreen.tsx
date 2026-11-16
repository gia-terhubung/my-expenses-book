import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { deviceTimeZone, formatLocal } from "@/capture/localTime";
import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import { listCategories } from "@/db/repositories/categories";
import { listFolders } from "@/db/repositories/folders";
import { sumHome, type ReceiptFilter } from "@/db/repositories/receiptQueries";
import { EmptyState } from "@/layout/EmptyState";
import { usePref } from "@/prefs/PrefsProvider";
import { totalLine } from "@/receipts/format";
import { ReceiptListDetail } from "@/receipts/ReceiptListDetail";
import { categoryLabel } from "@/review/ReviewFields";
import { useTheme } from "@/theme/ThemeProvider";

import { FilterSheet } from "./FilterSheet";
import { activeFilterCount, EMPTY_SEARCH, toFilter, type SearchState } from "./filterState";

const DEBOUNCE_MS = 250;
/** Matches nothing (a text filter with nothing searchable); keeps the list mounted while idle. */
const MATCH_NOTHING: ReceiptFilter = { text: "" };

/**
 * Search tab: debounced full-text query plus date, category, folder and currency filters. The
 * state lives here, above the list/detail split, so folding the device keeps it.
 */
export function SearchScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language || "en";
  const theme = useTheme();
  const db = useDb();
  const home = usePref("homeCurrency") ?? "USD";
  const startMonth = usePref("taxYearStartMonth") ?? 1;
  const version = useDataVersion();
  const [state, setState] = useState<SearchState>(EMPTY_SEARCH);
  const [queryText, setQueryText] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setQueryText(state.text), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [state.text]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const categories = useMemo(() => listCategories(db), [db, version]);
  // A category deleted while selected would keep filtering with no chip to remove it: ignore it.
  const effective = useMemo<SearchState>(() => {
    const live = state.categoryIds.filter((id) => categories.some((c) => c.id === id));
    return live.length === state.categoryIds.length ? state : { ...state, categoryIds: live };
  }, [state, categories]);

  const today = formatLocal(new Date(), deviceTimeZone()).slice(0, 10);
  const { preset, from, to, categoryIds, folderId, currency } = effective;
  const active = queryText.trim() !== "" || activeFilterCount(effective) > 0;
  const filter = useMemo<ReceiptFilter>(
    () =>
      active
        ? toFilter({ text: queryText, preset, from, to, categoryIds, folderId, currency }, today, startMonth)
        : MATCH_NOTHING,
    [active, queryText, preset, from, to, categoryIds, folderId, currency, today, startMonth],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const total = useMemo(() => (active ? sumHome(db, filter, home) : null), [db, active, filter, home, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const folders = useMemo(() => listFolders(db), [db, version]);

  const patch = (p: Partial<SearchState>) => setState((s) => ({ ...s, ...p }));
  const clearAll = () => {
    setState(EMPTY_SEARCH);
    setQueryText("");
  };

  const chips: { key: string; label: string; remove(): void }[] = [];
  if (preset !== "all") {
    const label =
      preset === "custom"
        ? [from, to].filter(Boolean).join(" – ") || t("search.preset.custom")
        : t(`search.preset.${preset}`);
    chips.push({ key: "preset", label, remove: () => patch({ preset: "all", from: "", to: "" }) });
  }
  for (const id of categoryIds) {
    const c = categories.find((x) => x.id === id);
    if (c) {
      chips.push({
        key: `cat:${id}`,
        label: categoryLabel(c, (k) => t(k)),
        remove: () => patch({ categoryIds: categoryIds.filter((x) => x !== id) }),
      });
    }
  }
  if (folderId !== undefined) {
    chips.push({
      key: "folder",
      label: folderId === null ? t("folders.none") : (folders.find((f) => f.id === folderId)?.name ?? "…"),
      remove: () => patch({ folderId: undefined }),
    });
  }
  if (currency) chips.push({ key: "currency", label: currency, remove: () => patch({ currency: undefined }) });

  const filterCount = activeFilterCount(effective);
  const link = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: theme.spacing.sm }}
    >
      <Text style={[theme.type.body, { color: theme.colors.primary, fontWeight: "600" }]}>{label}</Text>
    </Pressable>
  );

  return (
    <>
      <ReceiptListDetail
        filter={filter}
        ListHeaderComponent={
          <View style={{ paddingTop: theme.spacing.sm, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, gap: theme.spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
              <TextInput
                accessibilityLabel={t("search.label")}
                placeholder={t("search.placeholder")}
                placeholderTextColor={theme.colors.textMuted}
                value={state.text}
                onChangeText={(text) => patch({ text })}
                autoCorrect={false}
                returnKeyType="search"
                style={[
                  theme.type.body,
                  {
                    flex: 1,
                    minHeight: 48,
                    color: theme.colors.text,
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderWidth: 1,
                    borderRadius: theme.radius.md,
                    paddingHorizontal: theme.spacing.md,
                  },
                ]}
              />
              {link(filterCount > 0 ? `${t("search.filters")} (${filterCount})` : t("search.filters"), () => setSheetOpen(true))}
            </View>
            {chips.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, alignItems: "center" }}>
                {chips.map((c) => (
                  <Pressable
                    key={c.key}
                    accessibilityRole="button"
                    accessibilityLabel={t("search.removeFilter", { label: c.label })}
                    onPress={c.remove}
                    style={({ pressed }) => ({
                      minHeight: 48,
                      justifyContent: "center",
                      paddingHorizontal: theme.spacing.md,
                      borderRadius: theme.radius.md,
                      backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.surface,
                      borderWidth: 1,
                      borderColor: theme.colors.border,
                    })}
                  >
                    <Text style={[theme.type.body, { color: theme.colors.text }]}>{`${c.label} ✕`}</Text>
                  </Pressable>
                ))}
                {link(t("search.clearAll"), clearAll)}
              </View>
            ) : null}
            {total ? (
              <Text testID="search-total" style={[theme.type.headline, { color: theme.colors.text }]}>
                {`${t("folders.receiptCount", { count: total.count })} · ${totalLine(total, home, locale, (n) =>
                  t("totals.notConverted", { count: n }),
                )}`}
              </Text>
            ) : null}
          </View>
        }
        empty={
          active ? (
            <EmptyState title={t("search.noResults")} topInset={false} />
          ) : (
            <EmptyState title={t("tabs.search")} message={t("empty.search")} topInset={false} />
          )
        }
      />
      <FilterSheet
        visible={sheetOpen}
        value={effective}
        onApply={(next) => {
          setState((s) => ({ ...next, text: s.text }));
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
