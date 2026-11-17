import { useRef } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { AppModal } from "@/components/AppModal";
import { SHEET_CARD_MIN_CONTENT, SHEET_CARD_WIDTH } from "@/layout/layout";
import { useSideInsets } from "@/layout/SideSafeArea";
import { useLayout } from "@/layout/useLayout";
import { useTheme } from "@/theme/ThemeProvider";

export type CaptureMode = "scan" | "photos";
/** Sheet choices: a capture mode, or "manual" (empty draft, no photo). */
export type CaptureChoice = CaptureMode | "manual";

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
 * Bottom sheet behind the + button: full width on a phone, a centred 480 card from 600 of content
 * width, always inside the side insets. The choice is reported only after the sheet has fully
 * closed (iOS `onDismiss`), so the scanner / picker is never presented over a dismissing modal.
 */
export function CaptureSheet({
  visible,
  onClose,
  onChoose,
}: {
  visible: boolean;
  onClose: () => void;
  onChoose: (choice: CaptureChoice) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const side = useSideInsets();
  const layout = useLayout();
  const pending = useRef<CaptureChoice | null>(null);

  const flush = () => {
    const mode = pending.current;
    pending.current = null;
    if (mode) onChoose(mode);
  };
  const choose = (mode: CaptureChoice) => {
    pending.current = mode;
    onClose();
    // Android has no reliable onDismiss; its pickers are separate activities anyway.
    if (Platform.OS !== "ios") flush();
  };

  const option = (mode: CaptureChoice, label: string, primary = false) => (
    <Pressable
      accessibilityRole="button"
      onPress={() => choose(mode)}
      style={({ pressed }) => [
        styles.option,
        {
          borderRadius: theme.radius.control,
          borderCurve: "continuous",
          backgroundColor: primary
            ? pressed ? theme.colors.primaryPressed : theme.colors.primary
            : pressed ? theme.colors.tonalPressed : theme.colors.tonal,
          paddingHorizontal: theme.spacing.lg,
        },
      ]}
    >
      <Text style={[theme.type.body, { color: primary ? theme.colors.onPrimary : theme.colors.primary, fontWeight: "600" }]}>{label}</Text>
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
      {/* Backdrop fills the window behind the sheet: with the centred card on wide screens the
          strips beside it must dim too, not only the area above it. */}
      <View testID="capture-sheet-root" style={styles.root}>
      <Pressable
        testID="capture-backdrop"
        accessibilityRole="button"
        accessibilityLabel={t("common.cancel")}
        style={styles.backdrop}
        onPress={onClose}
      />
      <View testID="capture-sheet-frame" style={{ paddingLeft: side.left, paddingRight: side.right }}>
        <View
          testID="capture-sheet"
          style={{
            width: "100%",
            maxWidth: layout.content >= SHEET_CARD_MIN_CONTENT ? SHEET_CARD_WIDTH : "100%",
            alignSelf: "center",
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.sheet,
            borderTopRightRadius: theme.radius.sheet,
            borderCurve: "continuous",
            boxShadow: theme.elevation.sheet,
            padding: theme.spacing.lg,
            paddingBottom: insets.bottom + theme.spacing.lg,
            gap: theme.spacing.sm,
          }}
        >
          <View
            testID="capture-grab-handle"
            style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border }}
          />
          <Text accessibilityRole="header" style={[theme.type.title, { color: theme.colors.text, marginBottom: theme.spacing.sm }]}>
            {t("capture.title")}
          </Text>
          {option("scan", t("capture.scan"), true)}
          {option("photos", t("capture.import"))}
          {option("manual", t("capture.manual"))}
          <Pressable accessibilityRole="button" onPress={onClose} style={[styles.option, { paddingHorizontal: theme.spacing.lg }]}>
            <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{t("common.cancel")}</Text>
          </Pressable>
        </View>
      </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)" },
  option: { minHeight: 52, justifyContent: "center" },
});
