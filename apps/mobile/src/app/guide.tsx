import { router } from "expo-router";
import { useEffect } from "react";

import { GuideFlow } from "@/guide/GuideFlow";
import { usePrefs } from "@/prefs/PrefsProvider";

/** Settings → Show guide: the whole guide again; choices save as they are made. */
export default function GuideRoute() {
  const prefs = usePrefs();
  useEffect(() => prefs.set("guideSeen", true), [prefs]);
  return <GuideFlow mode="replay" onClose={() => router.back()} />;
}
