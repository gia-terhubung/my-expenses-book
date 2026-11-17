import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { AppState, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { AppModal } from "@/components/AppModal";
import type { ReceiptPage } from "@/db/types";
import { useImageStore } from "@/images/ImageStoreProvider";
import { useTheme } from "@/theme/ThemeProvider";

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

/**
 * Receipt photo(s): tap a page for a full-screen, zoomable view. `fill` = take the pane height
 * (side-by-side layout); otherwise each page keeps its aspect ratio (stacked layout, capped).
 */
export function PageViewer({ pages, fill = false }: { pages: ReceiptPage[]; fill?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const uris = useViewUris(pages);
  const [full, setFull] = useState<number | null>(null);

  const page = (p: ReceiptPage, i: number) => {
    const uri = uris[i];
    const aspectRatio = p.width && p.height ? p.width / p.height : 3 / 4;
    return (
      <Pressable
        key={p.id}
        accessibilityRole="imagebutton"
        accessibilityLabel={pages.length > 1 ? `${t("review.openPhoto")} ${t("review.pageOf", { current: i + 1, total: pages.length })}` : t("review.openPhoto")}
        disabled={!uri || uri === "error"}
        onPress={() => setFull(i)}
        style={[
          { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, overflow: "hidden", alignItems: "center", justifyContent: "center" },
          fill ? { flex: 1, minHeight: 240 } : { width: "100%", aspectRatio, maxHeight: 360, alignSelf: "center" },
        ]}
      >
        {uri === "error" ? (
          <Text style={[theme.type.body, { color: theme.colors.textMuted, padding: theme.spacing.lg }]}>{t("review.photoUnavailable")}</Text>
        ) : uri ? (
          // No disk cache: the only plaintext copy stays in cache/view/ (purged on background).
          <Image source={{ uri }} cachePolicy="none" contentFit="contain" style={{ width: "100%", height: "100%" }} />
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
          <ScrollView
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {fullUri && fullUri !== "error" ? (
              <Image source={{ uri: fullUri }} cachePolicy="none" contentFit="contain" style={{ flex: 1, minHeight: 300 }} />
            ) : null}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("review.closePhoto")}
            onPress={() => setFull(null)}
            style={{
              position: "absolute",
              top: insets.top + theme.spacing.sm,
              right: theme.spacing.lg,
              minHeight: 48,
              minWidth: 48,
              paddingHorizontal: theme.spacing.lg,
              justifyContent: "center",
              alignItems: "center",
              borderRadius: theme.radius.pill,
              backgroundColor: "rgba(0,0,0,0.6)",
            }}
          >
            <Text style={[theme.type.body, { color: "#fff", fontWeight: "600" }]}>{t("common.done")}</Text>
          </Pressable>
        </View>
      </AppModal>
    </View>
  );
}
