import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { AppModal } from "@/components/AppModal";
import { Button } from "@/components/Button";
import { DateField } from "@/components/DateField";
import { OptionRow } from "@/components/OptionRow";
import { useDb } from "@/db/DatabaseProvider";
import { listCategories } from "@/db/repositories/categories";
import { listFolders } from "@/db/repositories/folders";
import { listCurrenciesInUse } from "@/db/repositories/receiptQueries";
import { categoryLabel } from "@/review/ReviewFields";
import { useTheme } from "@/theme/ThemeProvider";

import type { DatePreset, SearchState } from "./filterState";

type Props = {
  visible: boolean;
  value: SearchState;
  onApply(next: SearchState): void;
  onClose(): void;
};

export const PRESETS: DatePreset[] = ["all", "thisMonth", "lastMonth", "thisTaxYear", "lastTaxYear", "custom"];

/** Filter sheet: edits a draft; Apply commits it, Cancel (or dismissing) discards it. */
export function FilterSheet(props: Props) {
  return (
    <AppModal
      visible={props.visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={props.onClose}
    >
      {/* Mounted only while open, so every opening starts from the committed state. */}
      {props.visible ? <SheetBody {...props} /> : null}
    </AppModal>
  );
}

function SheetBody({ value, onApply, onClose }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const [draft, setDraft] = useState(value);
  const categories = useMemo(() => listCategories(db), [db]);
  const folders = useMemo(() => listFolders(db), [db]);
  const currencies = useMemo(() => listCurrenciesInUse(db), [db]);
  const patch = (p: Partial<SearchState>) => setDraft((d) => ({ ...d, ...p }));

  const toggleCategory = (id: string) =>
    patch({
      categoryIds: draft.categoryIds.includes(id)
        ? draft.categoryIds.filter((c) => c !== id)
        : [...draft.categoryIds, id],
    });

  const heading = (label: string) => (
    <Text accessibilityRole="header" style={[theme.type.headline, { color: theme.colors.text, marginTop: theme.spacing.lg }]}>
      {label}
    </Text>
  );
  const action = (label: string, onPress: () => void) => (
    <Button variant="quiet" label={label} onPress={onPress} style={{ paddingHorizontal: theme.spacing.sm }} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: theme.spacing.md }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: theme.spacing.md,
        }}
      >
        {action(t("common.cancel"), onClose)}
        <Text accessibilityRole="header" style={[theme.type.headline, { color: theme.colors.text }]}>
          {t("search.filters")}
        </Text>
        {action(t("search.apply"), () => onApply(draft))}
      </View>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.sm,
          paddingBottom: insets.bottom + theme.spacing.xl,
        }}
      >
        {heading(t("search.date"))}
        {PRESETS.map((p) => (
          <OptionRow key={p} label={t(`search.preset.${p}`)} selected={draft.preset === p} onPress={() => patch({ preset: p })} />
        ))}
        {draft.preset === "custom" ? (
          <View style={{ gap: theme.spacing.md }}>
            <DateField label={t("search.from")} value={draft.from} onChange={(from) => patch({ from })} placeholder={t("review.datePlaceholder")} />
            <DateField label={t("search.to")} value={draft.to} onChange={(to) => patch({ to })} placeholder={t("review.datePlaceholder")} />
          </View>
        ) : null}

        {heading(t("review.category"))}
        {categories.map((c) => {
          const checked = draft.categoryIds.includes(c.id);
          const label = categoryLabel(c, (k) => t(k));
          return (
            <OptionRow key={c.id} role="checkbox" label={label} selected={checked} onPress={() => toggleCategory(c.id)} />
          );
        })}

        {heading(t("review.folder"))}
        <OptionRow label={t("search.anyFolder")} selected={draft.folderId === undefined} onPress={() => patch({ folderId: undefined })} />
        <OptionRow label={t("folders.none")} selected={draft.folderId === null} onPress={() => patch({ folderId: null })} />
        {folders.map((f) => (
          <OptionRow key={f.id} label={f.name} selected={draft.folderId === f.id} onPress={() => patch({ folderId: f.id })} />
        ))}

        {heading(t("review.currency"))}
        <OptionRow label={t("search.anyCurrency")} selected={draft.currency === undefined} onPress={() => patch({ currency: undefined })} />
        {currencies.map((c) => (
          <OptionRow key={c} label={c} selected={draft.currency === c} onPress={() => patch({ currency: c })} />
        ))}
      </ScrollView>
    </View>
  );
}
