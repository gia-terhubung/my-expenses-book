import { router, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { BackupReminder } from "@/backup/BackupReminder";
import { mayStartCapture } from "@/capture/captureGate";
import { CaptureSheet, pickPhotos, scanPages, type CaptureChoice } from "@/capture/CaptureSheet";
import { pendingCaptures } from "@/capture/pendingCapture";
import { useDb } from "@/db/DatabaseProvider";
import { listDraftIds } from "@/db/repositories/receipts";
import { useWindowClass } from "@/layout/useWindowClass";
import { useWhenUnobscured } from "@/lock/useWhenUnobscured";
import { usePref } from "@/prefs/PrefsProvider";
import { FeedEmpty } from "@/receipts/FeedEmpty";
import { feedFabVisible } from "@/receipts/feedFab";
import { ReceiptListDetail } from "@/receipts/ReceiptListDetail";
import { TotalsHeader } from "@/receipts/TotalsHeader";
import { createManualDraft } from "@/review/manualDraft";
import { themedStatusBarStyle } from "@/theme/ThemedStatusBar";
import { useTheme } from "@/theme/ThemeProvider";

const openReview = (ids: string[]) => {
  const [id, ...rest] = ids;
  router.push({ pathname: "/review/[id]", params: { id, queue: rest.join(",") } } as unknown as Href);
};

export default function ReceiptsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const db = useDb();
  const feedFilter = useMemo(() => ({}), []);
  const home = usePref("homeCurrency") ?? "USD";
  const [sheet, setSheet] = useState(false);
  const windowClass = useWindowClass();
  const { selected } = useLocalSearchParams<{ selected?: string }>();
  const afterUnlock = useWhenUnobscured();
  // Drafts left unreviewed (closed with "Review later", app killed mid-run) stay reachable.
  const [drafts, setDrafts] = useState<string[]>([]);
  useFocusEffect(useCallback(() => setDrafts(listDraftIds(db)), [db]));
  // Compact: the strip above the list is slip green, so its icons go light while Home is focused.
  // Wide layouts keep the themed icons: the rail and the detail pane under the bar are not green.
  const greenTop = windowClass === "compact";
  useFocusEffect(
    useCallback(() => {
      if (!greenTop) return;
      setStatusBarStyle("light");
      return () => setStatusBarStyle(themedStatusBarStyle(theme.scheme));
    }, [greenTop, theme.scheme]),
  );

  const start = async (mode: CaptureChoice) => {
    if (!mayStartCapture((key) => Alert.alert(t(key)))) return;
    if (mode === "manual") {
      openReview([createManualDraft(db, { home })]);
      return;
    }
    let uris: string[];
    try {
      uris = mode === "scan" ? await scanPages() : await pickPhotos();
    } catch {
      Alert.alert(t(mode === "scan" ? "capture.scanUnavailable" : "capture.importUnavailable"));
      return;
    }
    if (!uris.length) return;
    // URIs stay in memory; the route only gets a one-time token (no file paths in deep links).
    const token = pendingCaptures.put(mode, uris);
    // The picker/scanner may have backgrounded the app and the lock come up meanwhile: push only
    // once /lock is gone, so the capture modal never lands above it.
    afterUnlock(() => router.push({ pathname: "/capture", params: { token } } as unknown as Href));
  };

  return (
    <>
      <ReceiptListDetail
        filter={feedFilter}
        topInsetColor={greenTop ? theme.colors.slip : undefined}
        ListHeaderComponent={
          <>
            <TotalsHeader />
            {drafts.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                // The visible text only: the dot and the chevron are decoration.
                accessibilityLabel={t("review.continue", { n: drafts.length })}
                onPress={() => openReview(drafts)}
                style={({ pressed }) => ({
                  minHeight: 48,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: theme.spacing.md,
                  marginHorizontal: theme.spacing.sm,
                  paddingHorizontal: theme.spacing.lg,
                  borderRadius: theme.radius.control,
                  borderCurve: "continuous",
                  backgroundColor: theme.colors.brassFill,
                  boxShadow: `inset 0 0 0 1px ${theme.colors.brassRing}`,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.warning }} />
                <Text style={[theme.type.body, { flex: 1, color: theme.colors.warning, fontWeight: "600" }]}>
                  {t("review.continue", { n: drafts.length })}
                </Text>
                <Text style={[theme.type.body, { color: theme.colors.warning }]}>›</Text>
              </Pressable>
            ) : null}
            <BackupReminder />
          </>
        }
        // The header spacer above already applies the top inset.
        empty={<FeedEmpty onStart={(m) => void start(m)} />}
      />
      {feedFabVisible(windowClass, selected) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("capture.add")}
          onPress={() => setSheet(true)}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: theme.colors.primary, right: theme.spacing.xl, bottom: theme.spacing.xl, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.plus, { color: theme.colors.onPrimary }]}>+</Text>
        </Pressable>
      ) : null}
      <CaptureSheet visible={sheet} onClose={() => setSheet(false)} onChoose={(m) => void start(m)} />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  plus: { fontSize: 32, lineHeight: 34, fontWeight: "400" },
});
