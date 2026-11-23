import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import { GuideFlow } from "@/guide/GuideFlow";
import { ModalSideInset } from "@/layout/ModalSideInset";
import { usePrefs } from "@/prefs/PrefsProvider";

/**
 * Settings → Show guide: the whole guide again; choices save as they are made. Presented as a
 * full-screen modal: on iOS that is its own window, outside SideSafeArea, so it pads itself by the
 * root side insets (as the capture modals do); on Android it already sits inside SideSafeArea.
 */
export default function GuideRoute() {
  const prefs = usePrefs();
  useEffect(() => prefs.set("guideSeen", true), [prefs]);
  const flow = <GuideFlow mode="replay" onClose={() => router.back()} />;
  return Platform.OS === "ios" ? <ModalSideInset>{flow}</ModalSideInset> : flow;
}
