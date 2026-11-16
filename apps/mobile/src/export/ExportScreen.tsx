import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { DateField } from "@/components/DateField";
import { dateToLocalString } from "@/components/dateString";
import { ErrorPanel } from "@/components/ErrorPanel";
import { OptionRow } from "@/components/OptionRow";
import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import { listFolders } from "@/db/repositories/folders";
import { sumHome, type ReceiptFilter } from "@/db/repositories/receiptQueries";
import { expoFs } from "@/images/expoFs";
import { useImageStore } from "@/images/ImageStoreProvider";
import type { FileOps } from "@/images/store";
import { usePref } from "@/prefs/PrefsProvider";
import { totalLine } from "@/receipts/format";
import { categoryLabel } from "@/organize/categoryLabel";
import { FolderPicker } from "@/organize/FolderPicker";
import { useTheme } from "@/theme/ThemeProvider";

import { toCsv } from "./csv";
import { EXPORT_DIR, exportFileName, purgeExportDir, shareFile } from "./files";
import { presetRange, type RangePreset } from "./presets";
import { renderPdf } from "./pdf";
import { buildReportHtml, buildReportInput } from "./reportHtml";
import { loadExportRows } from "./rows";

const PRESETS: RangePreset[] = ["thisTaxYear", "lastTaxYear", "thisMonth", "lastMonth", "all", "custom"];
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

type Format = "csv" | "pdf";
// undefined = any folder, null = no folder, string = folder id (matches ReceiptFilter.folderId).
type FolderSel = string | null | undefined;

/**
 * Export a selection (date range + folder) as CSV or a PDF report, then hand the file to the
 * share sheet. Plaintext files go to cache/export/ (purged on cold start, never on background).
 * Params: `folderId`, `from`, `to` (Collection passes these).
 */
export function ExportScreen({ fs = expoFs, now = () => new Date() }: { fs?: FileOps; now?: () => Date }) {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language || "en";
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const store = useImageStore();
  const version = useDataVersion();
  const home = usePref("homeCurrency") ?? "USD";
  const startMonth = usePref("taxYearStartMonth") ?? 1;
  const params = useLocalSearchParams<{ folderId?: string; from?: string; to?: string }>();
  const today = useMemo(() => dateToLocalString(now()), [now]);

  const hasRange = Boolean(params.from || params.to);
  // A folder export (Collection passes only folderId) covers the whole folder, not just this tax year.
  const [preset, setPreset] = useState<RangePreset>(
    hasRange ? "custom" : params.folderId ? "all" : "thisTaxYear",
  );
  const [custom, setCustom] = useState({ from: params.from ?? "", to: params.to ?? "" });
  const [folder, setFolder] = useState<FolderSel>(params.folderId || undefined);
  const [pickingFolder, setPickingFolder] = useState(false);
  const [format, setFormat] = useState<Format>("csv");
  const [images, setImages] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbFailures, setThumbFailures] = useState(0);
  const inflight = useRef(false);

  const range = preset === "custom"
    ? { from: isDate(custom.from) ? custom.from : undefined, to: isDate(custom.to) ? custom.to : undefined }
    : presetRange(preset, today, startMonth);
  const filter: ReceiptFilter = { ...range, ...(folder !== undefined ? { folderId: folder } : {}) };
  const filterKey = JSON.stringify(filter);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const total = useMemo(() => sumHome(db, filter, home), [db, filterKey, home, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const folders = useMemo(() => listFolders(db), [db, version]);
  const folderName = typeof folder === "string" ? (folders.find((f) => f.id === folder)?.name ?? "") : null;
  const empty = total.count === 0;

  const rangeLabel = () => {
    if (preset === "all") return t("export.all");
    if (preset === "custom") return `${range.from ?? "…"} – ${range.to ?? "…"}`;
    return `${range.from} – ${range.to}`;
  };

  const run = async () => {
    // A ref, not `busy`: two taps in one frame both see busy === false.
    if (inflight.current || empty) return;
    inflight.current = true;
    setBusy(true);
    setError(null);
    setThumbFailures(0);
    try {
      await purgeExportDir(fs);
      const uri = fs.cacheDir + EXPORT_DIR + exportFileName(format, today);
      const label = (c: Parameters<typeof categoryLabel>[0]) => categoryLabel(c, t);
      if (format === "csv") {
        const rows = loadExportRows(db, filter, label);
        const csv = toCsv(rows, (c) => t(`export.csvHeader.${c}`));
        await fs.write(uri, Buffer.from(csv, "utf8"));
      } else {
        const input = await buildReportInput({
          db,
          store,
          filter,
          home,
          locale,
          t: (key, opts) => t(key, opts as Record<string, unknown>),
          includeThumbs: images,
          title: folderName || t("export.pdfTitle"),
          rangeLabel: rangeLabel(),
          now: now(),
        });
        await renderPdf(buildReportHtml(input), uri);
        setThumbFailures(input.thumbFailures);
      }
      await shareFile(uri, format);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      inflight.current = false;
    }
  };

  if (error !== null) {
    return <ErrorPanel title={t("export.failed")} details={error} onRetry={() => setError(null)} scope="export" />;
  }

  const section = (title: string) => (
    <Text accessibilityRole="header" style={[theme.type.headline, { color: theme.colors.text }]}>
      {title}
    </Text>
  );
  const disabled = busy || empty;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.xl, paddingTop: insets.top + theme.spacing.lg, paddingBottom: insets.bottom + theme.spacing.xl }}
    >
      <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: theme.spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => router.back()}
          style={{ minHeight: 48, justifyContent: "center", alignSelf: "flex-start" }}
        >
          <Text style={[theme.type.body, { color: theme.colors.primary, fontWeight: "600" }]}>{t("common.back")}</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[theme.type.title, { color: theme.colors.text }]}>
          {t("export.title")}
        </Text>

        {section(t("export.range"))}
        <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.sm }}>
          {PRESETS.map((p) => (
            <OptionRow key={p} label={t(`export.${p}`)} selected={p === preset} onPress={() => setPreset(p)} />
          ))}
        </View>
        {preset === "custom" ? (
          <View style={{ gap: theme.spacing.sm }}>
            <DateField label={t("export.from")} value={custom.from} onChange={(v) => setCustom((c) => ({ ...c, from: v }))} />
            <DateField label={t("export.to")} value={custom.to} onChange={(v) => setCustom((c) => ({ ...c, to: v }))} />
          </View>
        ) : null}

        {section(t("export.folder"))}
        <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.sm }}>
          <OptionRow label={t("export.folderAny")} selected={folder === undefined} onPress={() => setFolder(undefined)} />
          <OptionRow
            label={t("export.folderPick")}
            detail={folder === undefined ? undefined : (folderName ?? t("folders.none"))}
            selected={folder !== undefined}
            onPress={() => setPickingFolder(true)}
          />
        </View>
        <FolderPicker
          visible={pickingFolder}
          value={folder ?? null}
          onChange={(id) => {
            setFolder(id);
            setPickingFolder(false);
          }}
          onClose={() => setPickingFolder(false)}
        />

        {section(t("export.format"))}
        <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.sm }}>
          <OptionRow label={t("export.csv")} selected={format === "csv"} onPress={() => setFormat("csv")} />
          <OptionRow label={t("export.pdf")} selected={format === "pdf"} onPress={() => setFormat("pdf")} />
        </View>
        {format === "pdf" ? (
          <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.md }}>
            <Text style={[theme.type.body, { color: theme.colors.text, flex: 1 }]}>{t("export.images")}</Text>
            <Switch accessibilityLabel={t("export.images")} value={images} onValueChange={setImages} />
          </View>
        ) : null}

        <Text testID="export-summary" accessibilityLiveRegion="polite" style={[theme.type.body, { color: theme.colors.text }]}>
          {empty
            ? t("export.empty")
            : t("export.summary", {
                count: total.count,
                total: totalLine(total, home, locale, (n) => t("totals.notConverted", { count: n })),
              })}
        </Text>
        {thumbFailures > 0 ? (
          <Text accessibilityLiveRegion="polite" style={[theme.type.caption, { color: theme.colors.warning }]}>
            {t("export.thumbFailures", { count: thumbFailures })}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("export.run")}
          accessibilityState={{ disabled, busy }}
          disabled={disabled}
          onPress={() => void run()}
          style={{
            minHeight: 48,
            justifyContent: "center",
            alignItems: "center",
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.primary,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Text style={[theme.type.body, { color: theme.colors.onPrimary, fontWeight: "600" }]}>
            {busy ? t("export.busy") : t("export.run")}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
