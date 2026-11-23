import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { AppState, Pressable, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { AppModal } from "@/components/AppModal";
import type { ReceiptPage } from "@/db/types";
import { useImageStore } from "@/images/ImageStoreProvider";
import { useSideInsets } from "@/layout/SideSafeArea";
import { SlipEdge } from "@/receipts/SlipEdge";
import { useTheme } from "@/theme/ThemeProvider";

import { ZoomableImage } from "./ZoomableImage";
import { inlineCap } from "./zoomMath";

/**
 * Decrypted view files for `pages`, from ImageStore.openForView only (cache/view/, purged by the
 * provider on background). Re-opened when the app comes back, since the purge removed them.
 */
function useViewUris(pages: ReceiptPage[]): (string | null | "error")[] {
  const images = useImageStore();
  const [uris, setUris] = useState<(string | null | "error")[]>(() => pages.map(() => null));
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setEpoch((e) => e + 1);
    });
    return () => sub.remove();
  }, []);

  const key = pages.map((p) => p.imagePath).join("|");
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      pages.map((p) =>
        images.openForView(p.imagePath).then(
          (uri) => uri,
          () => "error" as const,
        ),
      ),
    ).then((out) => {
      if (!cancelled) setUris(out);
    });
    return () => {
      cancelled = true;
    };
    // `key` stands for `pages`; `epoch` re-opens after a background purge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, key, epoch]);
  return uris;
}

const HINT = 32;

/**
 * Receipt photo(s): tap a page for a full-screen, zoomable view. `fill` = take the pane height
 * (side-by-side layout, whole page visible); otherwise each page fills the width and is capped at
 * 55% of the window height. A capped page shows its top (store name and items) with the slip's torn
 * edge where it is cut, so it reads as "continues". Every page carries an expand hint.
 */
export function PageViewer({ pages, fill = false }: { pages: ReceiptPage[]; fill?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // A modal is its own window and reports its own side insets; the root ones are the real strips.
  const side = useSideInsets();
  const uris = useViewUris(pages);
  const [full, setFull] = useState<number | null>(null);
  // Measured box per page: only decides the torn edge, never the size (see `page`).
  const [boxes, setBoxes] = useState<Record<string, { width: number; height: number }>>({});
  const { height: windowHeight } = useWindowDimensions();
  const cap = inlineCap(windowHeight);

  const content = (uri: string | null | "error" | undefined) =>
    uri === "error" ? (
      <Text style={[theme.type.body, { color: theme.colors.textMuted, padding: theme.spacing.lg }]}>{t("review.photoUnavailable")}</Text>
    ) : uri ? (
      // No disk cache: the only plaintext copy stays in cache/view/ (purged on background).
      <Image testID="inline-photo" source={{ uri }} cachePolicy="none" contentFit="contain" style={{ width: "100%", height: "100%" }} />
    ) : null;

  const page = (p: ReceiptPage, i: number) => {
    const uri = uris[i];
    const aspectRatio = p.width && p.height ? p.width / p.height : 3 / 4;
    const box = boxes[p.id];
    // Cut when the full-width page is taller than the box the cap left it (1 pt rounding slack).
    const cropped = !fill && !!box && box.width / aspectRatio > box.height + 1;
    const ready = !!uri && uri !== "error";
    return (
      <Pressable
        key={p.id}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setBoxes((m) => (m[p.id]?.width === width && m[p.id]?.height === height ? m : { ...m, [p.id]: { width, height } }));
        }}
        accessibilityRole="imagebutton"
        accessibilityLabel={pages.length > 1 ? `${t("review.openPhoto")} ${t("review.pageOf", { current: i + 1, total: pages.length })}` : t("review.openPhoto")}
        disabled={!uri || uri === "error"}
        onPress={() => setFull(i)}
        style={[
          { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, overflow: "hidden" },
          fill
            ? { flex: 1, minHeight: 240, alignItems: "center", justifyContent: "center" }
            : // The box clips at the cap and the page inside keeps full width at its own shape, so the
              // top shows. No measured size: Fabric may skip onLayout on a Duo unfold (see SlipEdge),
              // and aspectRatio + maxHeight on one node let Yoga shrink the width instead.
              { width: "100%", maxHeight: cap },
        ]}
      >
        {fill ? (
          content(uri)
        ) : (
          <View testID="inline-page" style={{ width: "100%", aspectRatio, alignItems: "center", justifyContent: "center" }}>
            {content(uri)}
          </View>
        )}
        {cropped && ready ? <SlipEdge color={theme.colors.background} /> : null}
        {ready ? (
          <View
            testID="photo-expand-hint"
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={{
              position: "absolute",
              right: theme.spacing.sm,
              bottom: theme.spacing.sm + (cropped ? 5 : 0),
              width: HINT,
              height: HINT,
              borderRadius: HINT / 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Ionicons name="expand" size={16} color={theme.colors.text} />
          </View>
        ) : null}
      </Pressable>
    );
  };

  const fullUri = full === null ? null : uris[full];
  return (
    <View style={[{ gap: theme.spacing.sm }, fill && { flex: 1 }]}>
      {pages.map(page)}
      <AppModal visible={full !== null} sideInset={false} animationType="fade" onRequestClose={() => setFull(null)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {/* Inside the safe area: on the folded Duo the status column covers the right 84 pt. */}
          <View
            testID="photo-viewer-area"
            style={{
              flex: 1,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              paddingLeft: side.left,
              paddingRight: side.right,
            }}
          >
            {fullUri && fullUri !== "error" && full !== null ? (
              <ZoomableImage
                uri={fullUri}
                contentSize={{ width: pages[full]?.width ?? 0, height: pages[full]?.height ?? 0 }}
              />
            ) : null}
          </View>
          {/* Bottom centre, not top right: on the open Duo the status pill reaches into the
              top-right of the content, and the bottom is within thumb reach on a tall screen. */}
          <View
            testID="photo-done-bar"
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: side.left,
              right: side.right,
              bottom: insets.bottom + theme.spacing.lg,
              alignItems: "center",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("review.closePhoto")}
              onPress={() => setFull(null)}
              style={{
                minHeight: 48,
                minWidth: 48,
                paddingHorizontal: theme.spacing.lg,
                justifyContent: "center",
                alignItems: "center",
                borderRadius: theme.radius.pill,
                backgroundColor: "rgba(0,0,0,0.6)",
                // The hairline keeps the pill visible over black as well as over the white page.
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.45)",
              }}
            >
              <Text style={[theme.type.body, { color: "#fff", fontWeight: "600" }]}>{t("common.done")}</Text>
            </Pressable>
          </View>
        </View>
      </AppModal>
    </View>
  );
}
