import { useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { AppModal } from "@/components/AppModal";
import { useTheme } from "@/theme/ThemeProvider";

export type CaptureMode = "scan" | "photos";

/** Max photos per import: processed one at a time (low-RAM devices). */
export const IMPORT_LIMIT = 10;

/**
 * Opens the document scanner (multi-page -> one receipt). Returns page file URIs, [] when
 * cancelled. Throws when the scanner is unavailable (e.g. iOS simulator, web).
 */
export async function scanPages(): Promise<string[]> {
  // Lazy: the TurboModule lookup throws at import time where the native module is absent.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const scanner = require("react-native-document-scanner-plugin").default as typeof import("react-native-document-scanner-plugin").default;
  const res = await scanner.scanDocument({ croppedImageQuality: 90 });
  return res.status === "cancel" ? [] : (res.scannedImages ?? []);
}

/** Opens the photo library (multi-select -> one receipt per photo). Returns [] when cancelled. */
export async function pickPhotos(): Promise<string[]> {
  const ImagePicker = await import("expo-image-picker");
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: IMPORT_LIMIT,
    orderedSelection: true,
    quality: 1,
    exif: false,
  });
  return res.canceled ? [] : res.assets.map((a) => a.uri);
}

/**
 * Bottom sheet behind the + button. The choice is reported only after the sheet has fully
 * closed (iOS `onDismiss`), so the scanner / picker is never presented over a dismissing modal.
 */
export function CaptureSheet({
  visible,
  onClose,
  onChoose,
}: {
  visible: boolean;
  onClose: () => void;
  onChoose: (mode: CaptureMode) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pending = useRef<CaptureMode | null>(null);

  const flush = () => {
    const mode = pending.current;
    pending.current = null;
    if (mode) onChoose(mode);
  };
  const choose = (mode: CaptureMode) => {
    pending.current = mode;
    onClose();
    // Android has no reliable onDismiss; its pickers are separate activities anyway.
    if (Platform.OS !== "ios") flush();
  };

  const option = (mode: CaptureMode, label: string) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => choose(mode)}
      style={({ pressed }) => [
        styles.option,
        {
          borderRadius: theme.radius.md,
          backgroundColor: pressed ? theme.colors.border : theme.colors.background,
          paddingHorizontal: theme.spacing.lg,
        },
      ]}
    >
      <Text style={[theme.type.body, { color: theme.colors.text, fontWeight: "600" }]}>{label}</Text>
    </Pressable>
  );

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={flush}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Pressable accessibilityLabel={t("common.cancel")} style={styles.backdrop} onPress={onClose} />
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius.lg,
          borderTopRightRadius: theme.radius.lg,
          padding: theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.lg,
          gap: theme.spacing.sm,
        }}
      >
        <Text accessibilityRole="header" style={[theme.type.title, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
          {t("capture.title")}
        </Text>
        {option("scan", t("capture.scan"))}
        {option("photos", t("capture.import"))}
        <Pressable accessibilityRole="button" onPress={onClose} style={[styles.option, { paddingHorizontal: theme.spacing.lg }]}>
          <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{t("common.cancel")}</Text>
        </Pressable>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  option: { minHeight: 52, justifyContent: "center" },
});
