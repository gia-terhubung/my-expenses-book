import { router, Stack, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Platform, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button";
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
import { ScreenHeader } from "@/components/ScreenHeader";
import { useTheme } from "@/theme/ThemeProvider";

import { FolderForm } from "./FolderForm";

type Props =
  { kind: "folder"; folderId: string } | { kind: "taxYear"; year: number };

/** One folder or tax year: title, home total, folder actions, then its receipts. */
export function CollectionScreen(props: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language || "en";
  const theme = useTheme();
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
    const leave = () =>
      router.canGoBack()
        ? router.back()
        : router.replace("/folders" as unknown as Href);
    return (
      <EmptyState
        title={t(
          folderId !== null ? "folders.notFound" : "folders.taxYearInvalid",
        )}
      >
        <Button
          variant="quiet"
          label={t("common.back")}
          onPress={leave}
          style={{ alignSelf: "flex-start" }}
        />
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
      params:
        folderId !== null
          ? { folderId }
          : taxYearRange(year as number, startMonth),
    } as unknown as Href);

  const action = (label: string, onPress: () => void, destructive = false) => (
    <Button
      variant="quiet"
      tone={destructive ? "danger" : "default"}
      label={label}
      onPress={onPress}
      style={{ paddingHorizontal: theme.spacing.sm }}
    />
  );

  // SPIKE (iOS): a native header, so on the iPhone Duo Back, Export and ⋯ move into the side column.
  const nativeHeader = Platform.OS === "ios";

  return (
    <>
      {nativeHeader ? (
        <>
          <Stack.Screen
            options={{ headerShown: true, title, headerLargeTitle: false }}
          />
          <Stack.Toolbar placement="right">
            <Stack.Toolbar.Button
              icon="square.and.arrow.up"
              accessibilityLabel={t("export.title")}
              onPress={openExport}
            >
              {t("export.title")}
            </Stack.Toolbar.Button>
            {folder ? (
              <Stack.Toolbar.Menu
                icon="ellipsis"
                accessibilityLabel={t("common.more")}
              >
                <Stack.Toolbar.MenuAction
                  icon="pencil"
                  onPress={() => setRenaming(true)}
                >
                  {t("folders.rename")}
                </Stack.Toolbar.MenuAction>
                <Stack.Toolbar.MenuAction
                  icon="trash"
                  destructive
                  onPress={confirmDelete}
                >
                  {t("common.delete")}
                </Stack.Toolbar.MenuAction>
              </Stack.Toolbar.Menu>
            ) : null}
          </Stack.Toolbar>
        </>
      ) : null}
      <ReceiptListDetail
        filter={filter}
        ListHeaderComponent={
          <View
            style={{
              paddingTop: theme.spacing.sm,
              paddingHorizontal: theme.spacing.lg,
              paddingBottom: theme.spacing.md,
            }}
          >
            {nativeHeader ? null : <ScreenHeader title={title} />}
            <Text
              testID="collection-total"
              style={[theme.type.headline, { color: theme.colors.text }]}
            >
              {totalLine(total, home, locale, (n) =>
                t("totals.notConverted", { count: n }),
              )}
            </Text>
            {/* Wraps on narrow phones / long translations instead of clipping the last action. */}
            {nativeHeader ? null : (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: theme.spacing.md,
                }}
              >
                {action(t("export.title"), openExport)}
                {folder ? (
                  <>
                    {action(t("folders.rename"), () => setRenaming(true))}
                    {action(t("common.delete"), confirmDelete, true)}
                  </>
                ) : null}
              </View>
            )}
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
