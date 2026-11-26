import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { BackupReminder } from "@/backup/BackupReminder";
import { GuideBar } from "@/guide/GuideBar";
import { useAddReceiptContext } from "@/capture/AddReceiptProvider";
import { openReview } from "@/capture/useAddReceipt";
import { useDb } from "@/db/DatabaseProvider";
import { listDraftIds } from "@/db/repositories/receipts";
import { TabScreen } from "@/layout/TabPlus";
import { useLayout } from "@/layout/useLayout";
import { FeedEmpty } from "@/receipts/FeedEmpty";
import { ReceiptListDetail } from "@/receipts/ReceiptListDetail";
import { TotalsHeader } from "@/receipts/TotalsHeader";
import { CatchUpBanner } from "@/recurring/CatchUpBanner";
import { themedStatusBarStyle } from "@/theme/ThemedStatusBar";
import { useTheme } from "@/theme/ThemeProvider";

export default function ReceiptsTab() {
  return (
    <TabScreen toolbar>
      <ReceiptsScreen />
    </TabScreen>
  );
}

function ReceiptsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const db = useDb();
  const feedFilter = useMemo(() => ({}), []);
  const { split } = useLayout();
  const { selected } = useLocalSearchParams<{ selected?: string }>();
  const add = useAddReceiptContext();
  // Drafts left unreviewed (closed with "Review later", app killed mid-run) stay reachable.
  const [drafts, setDrafts] = useState<string[]>([]);
  useFocusEffect(useCallback(() => setDrafts(listDraftIds(db)), [db]));
  // The strip above the list is slip green (bar, or a single pane beside a rail), so its icons go
  // light while Home is focused. Split layouts keep the themed icons: the rail and the detail pane
  // under the bar are not green. So does a single pane with a receipt open: the detail covers the slip.
  const greenTop = !split && !selected;
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
            <CatchUpBanner />
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
            <GuideBar />
          </>
        }
        empty={<FeedEmpty onStart={(m) => void add.start(m)} />}
      />
    </>
  );
}
