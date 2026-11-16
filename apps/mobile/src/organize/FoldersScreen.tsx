import { router, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import { createFolder, listFolders } from "@/db/repositories/folders";
import { listPurchaseMonths, sumHome } from "@/db/repositories/receiptQueries";
import { totalLine } from "@/receipts/format";
import { usePref } from "@/prefs/PrefsProvider";
import {
  taxYearLabel,
  taxYearRange,
  taxYearsFromMonths,
} from "@/taxYear/taxYear";
import { useTheme } from "@/theme/ThemeProvider";
import { StatusBarInset } from "@/layout/StatusBarInset";

import { FolderForm } from "./FolderForm";

const go = (pathname: string, params: Record<string, string>) =>
  router.push({ pathname, params } as unknown as Href);

/** Folders tab: tax-year collections plus the user's folders, each with count and home total. */
export function FoldersScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language || "en";
  const theme = useTheme();
  const db = useDb();
  const home = usePref("homeCurrency") ?? "USD";
  const startMonth = usePref("taxYearStartMonth") ?? 1;
  const version = useDataVersion();
  const [creating, setCreating] = useState(false);

  const { years, folders } = useMemo(
    () => ({
      years: taxYearsFromMonths(listPurchaseMonths(db), startMonth).map(
        (year) => ({
          year,
          total: sumHome(db, taxYearRange(year, startMonth), home),
        }),
      ),
      folders: listFolders(db).map((f) => ({
        folder: f,
        total: sumHome(db, { folderId: f.id }, home),
      })),
    }),
    // version: re-read after any write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, version, home, startMonth],
  );

  const notConverted = (n: number) => t("totals.notConverted", { count: n });
  const heading = (text: string) => (
    <Text
      accessibilityRole="header"
      style={[
        theme.type.headline,
        { color: theme.colors.text, paddingTop: theme.spacing.lg },
      ]}
    >
      {text}
    </Text>
  );
  const row = (
    testID: string,
    title: string,
    sub: string,
    total: string,
    onPress: () => void,
    icon?: { glyph: string; kind: string },
  ) => (
    <Pressable
      key={testID}
      testID={testID}
      accessibilityRole="button"
      // The kind is spoken as a word; the emoji itself is decorative.
      accessibilityLabel={[icon?.kind, title, sub, total].filter(Boolean).join(", ")}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.md,
        backgroundColor: pressed ? theme.colors.border : theme.colors.surface,
      })}
    >
      {icon ? (
        <Text accessibilityElementsHidden importantForAccessibility="no" style={{ fontSize: 22 }}>
          {icon.glyph}
        </Text>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text
          style={[
            theme.type.body,
            { color: theme.colors.text, fontWeight: "600" },
          ]}
        >
          {title}
        </Text>
        <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>
          {sub}
        </Text>
      </View>
      <Text style={[theme.type.body, { color: theme.colors.text }]}>
        {total}
      </Text>
    </Pressable>
  );

  return (
    <StatusBarInset>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.sm,
        }}
      >
        {years.length > 0 ? heading(t("folders.taxYears")) : null}
        {years.map(({ year, total }) =>
          row(
            `tax-year-row-${year}`,
            taxYearLabel(year, startMonth),
            t("folders.receiptCount", { count: total.count }),
            totalLine(total, home, locale, notConverted),
            () => go("/tax-year/[year]", { year: String(year) }),
          ),
        )}
        {heading(t("folders.sectionFolders"))}
        {folders.length === 0 ? (
          <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>
            {t("empty.folders")}
          </Text>
        ) : null}
        {folders.map(({ folder, total }) =>
          row(
            `folder-row-${folder.id}`,
            folder.name,
            t("folders.receiptCount", { count: total.count }),
            totalLine(total, home, locale, notConverted),
            () => go("/folder/[id]", { id: folder.id }),
            folder.kind === "trip"
              ? { glyph: "✈️", kind: t("folders.kindTrip") }
              : { glyph: "📁", kind: t("folders.kindProject") },
          ),
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("folders.newTitle")}
          onPress={() => setCreating(true)}
          style={{
            minHeight: 48,
            justifyContent: "center",
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <Text
            style={[
              theme.type.body,
              { color: theme.colors.primary, fontWeight: "600" },
            ]}
          >
            {t("folders.new")}
          </Text>
        </Pressable>
      </ScrollView>
      <FolderForm
        visible={creating}
        mode="create"
        onClose={() => setCreating(false)}
        onSubmit={({ name, kind }) => {
          createFolder(db, { name, kind });
          setCreating(false);
        }}
      />
    </StatusBarInset>
  );
}
