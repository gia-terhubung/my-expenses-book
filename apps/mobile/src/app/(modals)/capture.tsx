import { Redirect, router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Button, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { OcrResult } from "../../../modules/receipt-ocr/src/ReceiptOcr.types";
import { mayStartCapture } from "@/capture/captureGate";
import { pendingCaptures, resolveCaptureRequest } from "@/capture/pendingCapture";
import { runCaptures, type CaptureDeps } from "@/capture/pipeline";
import { useDb } from "@/db/DatabaseProvider";
import { mergeFxCache } from "@/fx/mergeCache";
import { captureLease } from "@/images/captureLease";
import { useImageStore } from "@/images/ImageStoreProvider";
import { useAppObscured } from "@/lock/appObscured";
import { useWhenUnobscured } from "@/lock/useWhenUnobscured";
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

/** The working phase offers Cancel after this long (a stuck native call is bounded at 20 s). */
const CANCEL_AFTER_MS = 5_000;

type Phase =
  | { kind: "working"; index: number; total: number }
  | { kind: "split"; count: number }
  | { kind: "failed" };

/**
 * Runs the capture pipeline for the picker/scanner result handed over under `?token=` (see
 * pendingCapture: photos = one receipt per photo, scan = one receipt), asks before splitting a
 * multi-receipt photo, then replaces itself with the review route for the first draft (`queue` =
 * the rest, `failed` = photos that couldn't be saved). Never starts while the app is locked or
 * covered, and navigates only once unlocked (never above or in place of `/lock`). Cancel appears
 * after 5 s of work: it abandons the native call in flight and the pipeline cleans up. File URIs
 * in route params are honoured only in dev builds.
 */
export default function CaptureScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const db = useDb();
  const images = useImageStore();
  const prefs = usePrefs();
  const home = usePref("homeCurrency") ?? "USD";
  const language = usePref("language") ?? "en";
  const params = useLocalSearchParams<{ token?: string; mode?: string; uris?: string }>();
  const obscured = useAppObscured();
  const afterUnlock = useWhenUnobscured();
  const [phase, setPhase] = useState<Phase>({ kind: "working", index: 0, total: 1 });
  const [canCancel, setCanCancel] = useState(false);
  const abort = useRef(new AbortController());
  const answer = useRef<((c: "split" | "single" | null) => void) | null>(null);
  const cancelled = useRef(false);
  const left = useRef(false);
  const started = useRef(false);
  // Claimed once per screen instance (the token is single-use).
  const [groups] = useState(() => resolveCaptureRequest(params, { dev: __DEV__, pending: pendingCaptures }));

  useEffect(
    () => () => {
      // Leaving mid-run (Android back, Cancel): abandon the current step and clean up.
      left.current = true;
      cancelled.current = true;
      abort.current.abort();
      answer.current?.(null);
    },
    [],
  );

  useEffect(() => {
    setCanCancel(false);
    if (phase.kind !== "working") return;
    const timer = setTimeout(() => setCanCancel(true), CANCEL_AFTER_MS);
    return () => clearTimeout(timer);
  }, [phase.kind]);

  const cancelWork = () => {
    cancelled.current = true;
    abort.current.abort();
    left.current = true;
    router.back();
  };

  useEffect(() => {
    // Wait for unlock: nothing is read or written behind the lock screen / privacy cover.
    if (!groups || obscured || started.current) return;
    started.current = true;
    // A restore began after the picker returned: don't write pages its cleanup would delete.
    if (!mayStartCapture((key) => Alert.alert(t(key)))) {
      left.current = true;
      router.back();
      return;
    }
    const deps: CaptureDeps = {
      db,
      images,
      ocr: nativeOcr(),
      parse: parseReceipt,
      fx: { get: () => prefs.get("fxTables"), set: (c) => prefs.set("fxTables", mergeFxCache(prefs.get("fxTables"), c)) },
      home,
      uiLanguage: language,
      clock: () => new Date(),
      lease: () => captureLease.acquire(),
      signal: abort.current.signal,
    };
    const total = groups.length;
    void runCaptures(groups, deps, {
      chooseSplit: (count) =>
        new Promise((resolve) => {
          if (cancelled.current) return resolve(null);
          answer.current = resolve;
          setPhase({ kind: "split", count });
        }),
      onProgress: (index) => setPhase({ kind: "working", index, total }),
      isCancelled: () => cancelled.current,
    }).then(
      ({ ids, failed, cancelled: wasCancelled }) => {
        // Screen already gone: drafts made so far stay as drafts (listed by the drafts UI).
        if (left.current) return;
        if (ids.length) {
          const [first, ...rest] = ids;
          // Locked meanwhile (app switched during "Reading receipt…"): wait until /lock is gone,
          // so REPLACE acts on this screen and never on the lock route.
          afterUnlock(() => {
            if (left.current) return;
            router.replace({
              pathname: "/review/[id]",
              params: { id: first, queue: rest.join(","), failed: String(failed), total: String(total) },
            } as unknown as Href);
          });
        } else if (wasCancelled) {
          afterUnlock(() => {
            if (!left.current) router.back();
          });
        } else {
          setPhase({ kind: "failed" });
        }
      },
      () => {
        if (!left.current) setPhase({ kind: "failed" });
      },
    );
    // Starts once per screen instance (when first unobscured); deps are captured at start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obscured]);

  const reply = (c: "split" | "single" | null) => {
    if (c === null) cancelled.current = true;
    const resolve = answer.current;
    answer.current = null;
    setPhase((p) => (p.kind === "split" ? { kind: "working", index: 0, total: 0 } : p));
    resolve?.(c);
  };

  // Unknown / used token (or a release-build deep link with file URIs): nothing to capture.
  if (!groups) return <Redirect href="/" />;

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
          {/* Cancel deletes this photo's files; drafts made from earlier photos still open for review. */}
          <Button title={t("common.cancel")} onPress={() => reply(null)} />
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
        {canCancel ? <Button title={t("common.cancel")} onPress={cancelWork} /> : null}
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
