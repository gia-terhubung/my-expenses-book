import { router, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/Button";
import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import { listCategories } from "@/db/repositories/categories";
import { listFolders } from "@/db/repositories/folders";
import { listPages } from "@/db/repositories/pages";
import { getReceipt, updateReceipt } from "@/db/repositories/receipts";
import type { Receipt } from "@/db/types";
import { useImageStore } from "@/images/ImageStoreProvider";
import { formatMoney } from "@/money/money";
import { useTabBarSpace } from "@/layout/useTabBarSpace";
import { FolderPicker } from "@/organize/FolderPicker";
import { usePref } from "@/prefs/PrefsProvider";
import { PageViewer } from "@/review/PageViewer";
import { categoryLabel } from "@/review/ReviewFields";
import { discardReceipt } from "@/review/useReviewForm";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useTheme } from "@/theme/ThemeProvider";

import { homeLine } from "./format";

type Props = {
  id: string;
  onEdit(id: string): void;
  onDeleted(): void;
  onBack?: () => void;
};

/** Wall-clock purchase time as recorded ("2026-11-03T10:15:00"), locale-formatted, no zone shift. */
function localDateTime(local: string, locale: string): string {
  const [d, time = "00:00"] = local.split("T");
  const [y, mo, day] = d.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(
    Date.UTC(y, mo - 1, day, h, mi),
  );
}

function isoDate(date: string, locale: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(Date.UTC(y, mo - 1, d));
}

/**
 * Stored fxRate = home units per 1 receipt unit (see Conversion.fxRate in src/fx/convert.ts).
 * Shown as "1 <receipt> = <rate> <home>", or flipped to "1 <home> = <1/rate> <receipt>" when the
 * rate is below 0.1 (e.g. IDR -> USD), so the number stays readable. Display only.
 */
export function fxRateText(r: Receipt, locale: string, t: (k: string, o?: Record<string, unknown>) => string): string | null {
  const home = r.homeCurrencyAtSave;
  if (!r.fxRate || !home || home === r.currency) return null;
  const rate = Number(r.fxRate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const nf = new Intl.NumberFormat(locale, { maximumSignificantDigits: 6 });
  const pair =
    rate < 0.1
      ? t("receipts.detail.fx", { from: home, rate: nf.format(1 / rate), to: r.currency })
      : t("receipts.detail.fx", { from: r.currency, rate: nf.format(rate), to: home });
  const parts = [pair, r.fxRateDate ? t("receipts.detail.rateOn", { date: isoDate(r.fxRateDate, locale) }) : t("receipts.detail.manualRate")];
  if (r.fxApproximate) parts.push(t("receipts.detail.approximate"));
  return parts.join(" · ");
}

export function ReceiptDetail({ id, onEdit, onDeleted, onBack }: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language || "en";
  const theme = useTheme();
  const db = useDb();
  const images = useImageStore();
  // Compact detail shown over a tab's list: clear the floating tab bar.
  const tabBarSpace = useTabBarSpace();
  const home = usePref("homeCurrency") ?? "USD";
  const version = useDataVersion();
  const [picking, setPicking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // version: re-read after any write.
  /* eslint-disable react-hooks/exhaustive-deps */
  const receipt = useMemo(() => getReceipt(db, id), [db, id, version]);
  const pages = useMemo(() => listPages(db, id), [db, id, version]);
  const category = useMemo(
    () => (receipt?.categoryId ? listCategories(db).find((c) => c.id === receipt.categoryId) : undefined),
    [db, receipt?.categoryId, version],
  );
  const folder = useMemo(
    () => (receipt?.folderId ? listFolders(db).find((f) => f.id === receipt.folderId) : undefined),
    [db, receipt?.folderId, version],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  if (!receipt) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.xl, gap: theme.spacing.md }}>
        <ScreenHeader title={t("document.title")} onBack={onBack ?? null} />
        <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{t("receipts.detail.missing")}</Text>
      </View>
    );
  }

  const conv = homeLine(receipt, home, locale);
  const fx = fxRateText(receipt, locale, t);

  const confirmDelete = () =>
    Alert.alert(t("receipts.detail.deleteTitle"), t("receipts.detail.deleteMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          setDeleting(true);
          discardReceipt(db, images, receipt.id).then(
            () => {
              setDeleting(false);
              onDeleted();
            },
            (e: unknown) => {
              setDeleting(false);
              if (__DEV__) console.warn("receipt delete failed", e);
              Alert.alert(t("receipts.detail.deleteFailed"));
            },
          );
        },
      },
    ]);

  const field = (label: string, value: string) => (
    <View style={{ gap: theme.spacing.xs }}>
      <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{label}</Text>
      <Text style={[theme.type.body, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );

  const action = (label: string, onPress: () => void, tone: "default" | "danger" = "default", disabled = false) => (
    <Button label={label} onPress={onPress} tone={tone} disabled={disabled} style={{ flexGrow: 1 }} />
  );

  return (
    <>
      <ScrollView
        testID="receipt-detail-scroll"
        contentInsetAdjustmentBehavior="never"
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{
          width: "100%",
          maxWidth: 640,
          alignSelf: "center",
          padding: theme.spacing.xl,
          paddingBottom: tabBarSpace || theme.spacing.xl,
          gap: theme.spacing.lg,
        }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <ScreenHeader title={receipt.merchant ?? t("receipts.unknownMerchant")} titleStyle="headline" onBack={onBack ?? null} />
          <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{localDateTime(receipt.purchasedAtLocal, locale)}</Text>
        </View>
        <View style={{ gap: theme.spacing.xs }}>
          <Text style={[theme.type.title, { color: theme.colors.text }]}>{formatMoney(receipt.totalMinor, receipt.currency, locale)}</Text>
          {conv ? <Text style={[theme.type.body, { color: theme.colors.text }]}>{conv}</Text> : null}
          {fx ? (
            <Text testID="fx-line" style={[theme.type.body, { color: theme.colors.textMuted }]}>
              {fx}
            </Text>
          ) : null}
        </View>
        <View testID="receipt-detail-actions" style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          {action(t("receipts.detail.edit"), () => onEdit(receipt.id))}
          {action(t("receipts.detail.move"), () => setPicking(true))}
          {/* A receipt a rule already owns is not offered again (it would move to the new rule). */}
          {receipt.status === "confirmed" && receipt.recurringRuleId === null
            ? action(t("recurring.repeatThis"), () =>
                router.push({ pathname: "/recurring/[id]", params: { id: "new", from: receipt.id } } as unknown as Href),
              )
            : null}
          {action(t("common.delete"), confirmDelete, "danger", deleting)}
        </View>
        {field(t("receipts.detail.category"), category ? categoryLabel(category, t) : t("review.noCategory"))}
        {field(t("receipts.detail.folder"), folder?.name ?? t("folders.none"))}
        {receipt.notes ? field(t("receipts.detail.notes"), receipt.notes) : null}
        {pages.length > 0 ? <PageViewer pages={pages} /> : null}
      </ScrollView>
      <FolderPicker
        visible={picking}
        value={receipt.folderId}
        onChange={(folderId) => {
          updateReceipt(db, receipt.id, { folderId });
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </>
  );
}
