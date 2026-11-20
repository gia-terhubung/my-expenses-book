import { router, type Href } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";

import { now } from "@/dates/clock";
import { useDb } from "@/db/DatabaseProvider";
import { useWhenUnobscured } from "@/lock/useWhenUnobscured";
import { usePref } from "@/prefs/PrefsProvider";
import { createManualDraft } from "@/review/manualDraft";

import { mayStartCapture } from "./captureGate";
import { CaptureSheet, pickPhotos, scanPages, type CaptureChoice } from "./CaptureSheet";
import { pendingCaptures } from "./pendingCapture";

export const openReview = (ids: string[]) => {
  const [id, ...rest] = ids;
  router.push({ pathname: "/review/[id]", params: { id, queue: rest.join(",") } } as unknown as Href);
};

/**
 * The one add-receipt flow: `open` shows `sheet`; `start` runs a choice directly (the empty feed's
 * buttons). The tabs share one instance through `AddReceiptProvider`; pushed screens such as
 * Statistik call it directly.
 */
export function useAddReceipt(): { open(): void; start(mode: CaptureChoice): Promise<void>; sheet: React.ReactElement } {
  const { t } = useTranslation();
  const db = useDb();
  const home = usePref("homeCurrency") ?? "USD";
  const [visible, setVisible] = useState(false);
  const afterUnlock = useWhenUnobscured();

  const start = async (mode: CaptureChoice) => {
    if (!mayStartCapture((key) => Alert.alert(t(key)))) return;
    if (mode === "manual") {
      openReview([createManualDraft(db, { home, now: now() })]);
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

  return {
    open: () => setVisible(true),
    start,
    sheet: <CaptureSheet visible={visible} onClose={() => setVisible(false)} onChoose={(m) => void start(m)} />,
  };
}
