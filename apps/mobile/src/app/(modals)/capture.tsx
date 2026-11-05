import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Button, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { OcrResult } from "../../../modules/receipt-ocr/src/ReceiptOcr.types";
import { runCaptures, type CaptureDeps } from "@/capture/pipeline";
import { useDb } from "@/db/DatabaseProvider";
import { captureLease } from "@/images/captureLease";
import { useImageStore } from "@/images/ImageStoreProvider";
import { parseReceipt } from "@/parsing";
import { usePref, usePrefs } from "@/prefs/PrefsProvider";
import { useTheme } from "@/theme/ThemeProvider";

type Ocr = CaptureDeps["ocr"];

// Lazy: requireNativeModule throws where the module is absent (web); the pipeline then
// treats it as an OCR failure and still saves the image as a manual draft.
function nativeOcr(): Ocr {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const load = () => require("../../../modules/receipt-ocr") as Ocr;
  return {
    recognizeText: (uri, languages): Promise<OcrResult> => load().recognizeText(uri, languages),
    imageHash: (uri) => load().imageHash(uri),
  };
}

function parseUris(raw: string | undefined): string[] {
  try {
    const v: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}

type Phase =
  | { kind: "working"; index: number; total: number }
  | { kind: "split"; count: number }
  | { kind: "failed" };

/**
 * Runs the capture pipeline for picked photos (`mode=photos`: one receipt per photo) or
 * scanner pages (`mode=scan`: one receipt), asks before splitting a multi-receipt photo,
 * then replaces itself with the review route for the first draft (`queue` = the rest).
 */
export default function CaptureScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const db = useDb();
  const images = useImageStore();
  const prefs = usePrefs();
  const home = usePref("homeCurrency") ?? "USD";
  const language = usePref("language") ?? "en";
  const params = useLocalSearchParams<{ mode?: string; uris?: string }>();
  const [phase, setPhase] = useState<Phase>({ kind: "working", index: 0, total: 1 });
  const answer = useRef<((c: "split" | "single" | null) => void) | null>(null);
  const cancelled = useRef(false);

  // Read once: params are fixed for this screen instance.
  const groups = useMemo(() => {
    const uris = parseUris(params.uris);
    return params.mode === "scan" ? (uris.length ? [uris] : []) : uris.map((u) => [u]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const deps: CaptureDeps = {
      db,
      images,
      ocr: nativeOcr(),
      parse: parseReceipt,
      fx: { get: () => prefs.get("fxTables"), set: (c) => prefs.set("fxTables", c) },
      home,
      uiLanguage: language,
      clock: () => new Date(),
      lease: () => captureLease.acquire(),
    };
    void runCaptures(groups, deps, {
      chooseSplit: (count) =>
        new Promise((resolve) => {
          if (cancelled.current) return resolve(null);
          answer.current = resolve;
          setPhase({ kind: "split", count });
        }),
      onProgress: (index, total) => setPhase({ kind: "working", index, total }),
      isCancelled: () => cancelled.current,
    }).then(({ ids, cancelled: wasCancelled }) => {
      if (wasCancelled || cancelled.current) return;
      if (!ids.length) {
        setPhase({ kind: "failed" });
        return;
      }
      const [first, ...rest] = ids;
      router.replace({ pathname: "/review/[id]", params: { id: first, queue: rest.join(",") } } as unknown as Href);
    }, () => {
      if (!cancelled.current) setPhase({ kind: "failed" });
    });
    return () => {
      // Leaving mid-run (swipe down / back): stop after the current step and clean up.
      cancelled.current = true;
      answer.current?.(null);
    };
    // Runs once per screen instance; deps are captured at start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reply = (c: "split" | "single") => {
    const resolve = answer.current;
    answer.current = null;
    setPhase((p) => (p.kind === "split" ? { kind: "working", index: 0, total: 0 } : p));
    resolve?.(c);
  };

  const body = () => {
    if (phase.kind === "failed") {
      return (
        <>
          <Text style={[theme.type.title, { color: theme.colors.text }]}>{t("capture.failed")}</Text>
          <Button title={t("common.done")} onPress={() => router.back()} />
        </>
      );
    }
    if (phase.kind === "split") {
      return (
        <>
          <Text accessibilityRole="header" style={[theme.type.title, { color: theme.colors.text }]}>
            {t("capture.multiTitle", { n: phase.count })}
          </Text>
          <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{t("capture.multiHint")}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => reply("split")}
            style={{
              minHeight: 48,
              justifyContent: "center",
              alignItems: "center",
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.primary,
            }}
          >
            <Text style={[theme.type.body, { color: theme.colors.onPrimary, fontWeight: "600" }]}>
              {t("capture.split", { n: phase.count })}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => reply("single")}
            style={{
              minHeight: 48,
              justifyContent: "center",
              alignItems: "center",
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Text style={[theme.type.body, { color: theme.colors.text }]}>{t("capture.keepOne")}</Text>
          </Pressable>
          {/* Leaving resolves the prompt with null: the run deletes this photo's files. */}
          <Button title={t("common.cancel")} onPress={() => router.back()} />
        </>
      );
    }
    return (
      <>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text accessibilityLiveRegion="polite" style={[theme.type.body, { color: theme.colors.text, textAlign: "center" }]}>
          {phase.total > 1
            ? t("capture.processingMany", { current: phase.index + 1, total: phase.total })
            : t("capture.processing")}
        </Text>
      </>
    );
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        padding: theme.spacing.xl,
        gap: theme.spacing.lg,
        backgroundColor: theme.colors.background,
      }}
    >
      {/* No swipe-to-dismiss while files are being written; the split prompt and errors have buttons. */}
      <Stack.Screen options={{ gestureEnabled: phase.kind === "failed" }} />
      {body()}
    </View>
  );
}
