import { router, type Href } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { CaptureSheet, pickPhotos, scanPages, type CaptureMode } from "@/capture/CaptureSheet";
import { pendingCaptures } from "@/capture/pendingCapture";
import { EmptyState } from "@/layout/EmptyState";
import { useTheme } from "@/theme/ThemeProvider";

export default function ReceiptsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [sheet, setSheet] = useState(false);

  const start = async (mode: CaptureMode) => {
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
    router.push({ pathname: "/capture", params: { token } } as unknown as Href);
  };

  return (
    <>
      <EmptyState title={t("tabs.receipts")} message={t("empty.receipts")} />
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
