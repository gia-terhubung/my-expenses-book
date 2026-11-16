import { router, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import {
  listFolders,
  renameFolder,
  softDeleteFolder,
} from "@/db/repositories/folders";
import { sumHome, type ReceiptFilter } from "@/db/repositories/receiptQueries";
import { EmptyState } from "@/layout/EmptyState";
import { usePref } from "@/prefs/PrefsProvider";
import { totalLine } from "@/receipts/format";
import { ReceiptListDetail } from "@/receipts/ReceiptListDetail";
import { taxYearLabel, taxYearRange } from "@/taxYear/taxYear";
import { useTheme } from "@/theme/ThemeProvider";

import { FolderForm } from "./FolderForm";

type Props =
  { kind: "folder"; folderId: string } | { kind: "taxYear"; year: number };

/** One folder or tax year: title, home total, folder actions, then its receipts. */
export function CollectionScreen(props: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language || "en";
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const home = usePref("homeCurrency") ?? "USD";
  const startMonth = usePref("taxYearStartMonth") ?? 1;
  const version = useDataVersion();
  const [renaming, setRenaming] = useState(false);
  const folderId = props.kind === "folder" ? props.folderId : null;
  const year = props.kind === "taxYear" ? props.year : null;

  const filter = useMemo<ReceiptFilter>(
    () =>
      folderId !== null
        ? { folderId }
        : taxYearRange(year as number, startMonth),
    [folderId, year, startMonth],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const folder = useMemo(
    () =>
      folderId
        ? (listFolders(db).find((f) => f.id === folderId) ?? null)
        : null,
    [db, folderId, version],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const total = useMemo(
    () => sumHome(db, filter, home),
    [db, filter, home, version],
  );

  // Deleted / unknown folder, or a tax-year param that isn't a number: say so and offer a way out.
  const missing = folderId !== null ? !folder : !Number.isFinite(year);
  if (missing) {
    const leave = () => (router.canGoBack() ? router.back() : router.replace("/folders" as unknown as Href));
    return (
      <EmptyState title={t(folderId !== null ? "folders.notFound" : "folders.taxYearInvalid")}>
        <Pressable
          accessibilityRole="button"
          onPress={leave}
          style={{ minHeight: 48, justifyContent: "center", alignSelf: "flex-start" }}
        >
          <Text style={[theme.type.body, { color: theme.colors.primary, fontWeight: "600" }]}>{t("common.back")}</Text>
        </Pressable>
      </EmptyState>
    );
  }

  const title = folder
    ? folder.name
    : t("folders.taxYearTitle", {
        label: taxYearLabel(year as number, startMonth),
      });
  const confirmDelete = () =>
    Alert.alert(t("folders.deleteTitle"), t("folders.deleteMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          softDeleteFolder(db, folderId as string);
          router.back();
        },
      },
    ]);

  const openExport = () =>
    router.push({
      pathname: "/export",
      params: folderId !== null ? { folderId } : taxYearRange(year as number, startMonth),
    } as unknown as Href);

  const action = (label: string, onPress: () => void, destructive = false) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minHeight: 48,
        justifyContent: "center",
        paddingHorizontal: theme.spacing.sm,
      }}
    >
      <Text
        style={[
          theme.type.body,
          {
            color: destructive ? theme.colors.danger : theme.colors.primary,
            fontWeight: "600",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <>
      <ReceiptListDetail
        filter={filter}
        ListHeaderComponent={
          <View
            style={{
              paddingTop: insets.top,
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: theme.spacing.md,
            }}
          >
            {action(t("common.back"), () => router.back())}
            <Text
              accessibilityRole="header"
              style={[theme.type.title, { color: theme.colors.text }]}
            >
              {title}
            </Text>
            <Text
              testID="collection-total"
              style={[theme.type.headline, { color: theme.colors.text }]}
            >
              {totalLine(total, home, locale, (n) =>
                t("totals.notConverted", { count: n }),
              )}
            </Text>
            {/* Wraps on narrow phones / long translations instead of clipping the last action. */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md }}>
              {action(t("export.title"), openExport)}
              {folder ? (
                <>
                  {action(t("folders.rename"), () => setRenaming(true))}
                  {action(t("common.delete"), confirmDelete, true)}
                </>
              ) : null}
            </View>
          </View>
        }
        empty={<EmptyState title={t("folders.noReceipts")} topInset={false} />}
      />
      {folder ? (
        <FolderForm
          visible={renaming}
          mode="rename"
          initialName={folder.name}
          onClose={() => setRenaming(false)}
          onSubmit={({ name }) => {
            renameFolder(db, folder.id, name);
            setRenaming(false);
          }}
        />
      ) : null}
    </>
  );
}
