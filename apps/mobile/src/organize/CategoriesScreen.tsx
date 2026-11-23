import { useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import {
  countReceiptsByCategory,
  createCategory,
  listCategories,
  renameCategory,
  softDeleteCategory,
} from "@/db/repositories/categories";
import type { Category } from "@/db/types";
import { categoryLabel } from "@/review/ReviewFields";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useTheme } from "@/theme/ThemeProvider";
import { StatusBarInset } from "@/layout/StatusBarInset";

import { CategoryForm } from "./CategoryForm";

type FormState = { mode: "create" } | { mode: "rename"; category: Category } | null;

/** Settings > Categories: add, rename, reset and delete categories, with receipt counts. */
export function CategoriesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const version = useDataVersion();
  const [form, setForm] = useState<FormState>(null);

  const { list, counts } = useMemo(
    () => ({ list: listCategories(db), counts: countReceiptsByCategory(db) }),
    // version: re-read after any write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, version],
  );
  const label = (c: Category) => categoryLabel(c, t);
  const otherLabel = label(list.find((c) => c.id === "default:other") ?? ({ customName: null, nameKey: "other" } as Category));

  const confirmDelete = (c: Category) => {
    const count = counts[c.id] ?? 0;
    Alert.alert(t("categoryManage.deleteTitle"), t("categoryManage.deleteMessage", { count, other: otherLabel }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => softDeleteCategory(db, c.id),
      },
    ]);
  };

  const action = (text: string, name: string, onPress: () => void, destructive = false) => (
    <Button
      variant="quiet"
      tone={destructive ? "danger" : "default"}
      label={text}
      // Every row has the same actions: the name tells them apart (hints are often turned off).
      accessibilityLabel={`${text}, ${name}`}
      onPress={onPress}
      style={{ paddingHorizontal: theme.spacing.sm }}
    />
  );

  return (
    <StatusBarInset>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.lg,
          gap: theme.spacing.sm,
        }}
      >
        <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: theme.spacing.sm }}>
          <ScreenHeader title={t("categoryManage.title")} />
          {list.map((c) => {
            const name = label(c);
            return (
              <Card key={c.id} testID={`category-row-${c.id}`}>
                {c.color ? (
                  <View style={{ width: 12, height: 12, borderRadius: theme.radius.pill, backgroundColor: c.color }} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={[theme.type.body, { color: theme.colors.text, fontWeight: "600" }]}>{name}</Text>
                  <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>
                    {t("categoryManage.receiptCount", { count: counts[c.id] ?? 0 })}
                  </Text>
                </View>
                {action(t("categoryManage.rename"), name, () => setForm({ mode: "rename", category: c }))}
                {c.isDefault && c.customName !== null
                  ? action(t("categoryManage.reset"), name, () => renameCategory(db, c.id, null))
                  : null}
                {!c.isDefault ? action(t("common.delete"), name, () => confirmDelete(c), true) : null}
              </Card>
            );
          })}
          <Button
            variant="quiet"
            label={t("categoryManage.new")}
            onPress={() => setForm({ mode: "create" })}
            style={{ paddingHorizontal: theme.spacing.lg }}
          />
        </View>
      </ScrollView>
      <CategoryForm
        visible={form !== null}
        mode={form?.mode ?? "create"}
        initialName={form?.mode === "rename" ? label(form.category) : ""}
        onClose={() => setForm(null)}
        onSubmit={({ name, color }) => {
          if (form?.mode === "rename") renameCategory(db, form.category.id, name);
          else createCategory(db, { name, color });
          setForm(null);
        }}
      />
    </StatusBarInset>
  );
}
