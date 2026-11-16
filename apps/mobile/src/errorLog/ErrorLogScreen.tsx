import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { dateToLocalString } from "@/components/dateString";
import { EXPORT_DIR, purgeExportDir, shareFile } from "@/export/files";
import { expoFs } from "@/images/expoFs";
import type { FileOps } from "@/images/store";
import { useTheme } from "@/theme/ThemeProvider";

import type { ErrorEntry, ErrorLog } from "./errorLog";
import { errorLog } from "./instance";

/** Local error log: view, export through the share sheet (cache/export/), clear. */
export function ErrorLogScreen({
  log = errorLog,
  fs = expoFs,
  now = () => new Date(),
  appVersion,
}: {
  log?: ErrorLog;
  fs?: FileOps;
  now?: () => Date;
  appVersion: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [entries, setEntries] = useState<ErrorEntry[]>(() => log.list());
  const inflight = useRef(false);

  const exportLog = async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      await purgeExportDir(fs);
      const uri = `${fs.cacheDir}${EXPORT_DIR}errors-${dateToLocalString(now())}.txt`;
      await fs.write(uri, Buffer.from(log.toText(appVersion), "utf8"));
      await shareFile(uri, "txt");
    } catch {
      // Share sheet dismissed or write failed: nothing to report beyond staying on the screen.
    } finally {
      inflight.current = false;
    }
  };

  const clear = () =>
    Alert.alert(t("errorLog.clear"), t("errorLog.clearConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("errorLog.clear"),
        style: "destructive",
        onPress: () => {
          log.clear();
          setEntries([]);
        },
      },
    ]);

  return (
    <FlatList
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.xl, gap: theme.spacing.md, width: "100%", maxWidth: 560, alignSelf: "center" }}
      data={entries}
      keyExtractor={(e, i) => `${e.at}-${i}`}
      ListHeaderComponent={
        <View style={{ gap: theme.spacing.md }}>
          <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{t("errorLog.intro")}</Text>
          {entries.length ? (
            <View style={{ flexDirection: "row", gap: theme.spacing.xl }}>
              <Button variant="quiet" label={t("errorLog.export")} onPress={() => void exportLog()} />
              <Button variant="quiet" tone="danger" label={t("errorLog.clear")} onPress={clear} />
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={<Text style={[theme.type.body, { color: theme.colors.text }]}>{t("errorLog.empty")}</Text>}
      renderItem={({ item }) => (
        <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.spacing.lg, gap: theme.spacing.xs }}>
          <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>
            {new Date(item.at).toISOString()} · {item.scope}
          </Text>
          <Text selectable style={[theme.type.body, { color: theme.colors.text }]}>
            {item.message}
          </Text>
          {item.stack ? (
            <Text selectable numberOfLines={8} style={[theme.type.caption, { color: theme.colors.textMuted }]}>
              {item.stack}
            </Text>
          ) : null}
        </View>
      )}
    />
  );
}
