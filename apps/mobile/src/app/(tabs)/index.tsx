import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { BackupReminder } from "@/backup/BackupReminder";
import { openReview, useAddReceipt } from "@/capture/useAddReceipt";
import { useDb } from "@/db/DatabaseProvider";
import { listDraftIds } from "@/db/repositories/receipts";
import { useWindowClass } from "@/layout/useWindowClass";
import { FeedEmpty } from "@/receipts/FeedEmpty";
import { feedFabVisible } from "@/receipts/feedFab";
import { ReceiptListDetail } from "@/receipts/ReceiptListDetail";
import { TotalsHeader } from "@/receipts/TotalsHeader";
import { themedStatusBarStyle } from "@/theme/ThemedStatusBar";
import { useTheme } from "@/theme/ThemeProvider";

export default function ReceiptsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const db = useDb();
  const feedFilter = useMemo(() => ({}), []);
  const windowClass = useWindowClass();
  const { selected } = useLocalSearchParams<{ selected?: string }>();
  // Wide layouts: the FAB opens the shared add sheet. Compact: the tab bar's + does.
  const add = useAddReceipt();
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
        empty={<FeedEmpty onStart={(m) => void add.start(m)} />}
      />
      {feedFabVisible(windowClass, selected) ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("capture.add")}
          onPress={add.open}
          style={({ pressed }) => [
            styles.fab,
            {
              width: theme.size.fab,
              height: theme.size.fab,
              backgroundColor: theme.colors.primary,
              boxShadow: theme.elevation.raised,
              right: theme.spacing.xl,
              bottom: theme.spacing.xl,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.plus, { color: theme.colors.onPrimary }]}>+</Text>
        </Pressable>
      ) : null}
      {add.sheet}
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    borderRadius: 20,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  plus: { fontSize: 32, lineHeight: 34, fontWeight: "400" },
});
