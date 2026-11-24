// Dev-only: myexpensesbook://dev/store-shots?lang=<en|id|es|pt-BR>&photo=<url>&w=<px>&h=<px>
// Seeds the store-screenshot data for one language (refuses on a database with real receipts),
// sets language, home currency and a finished onboarding, attaches the review draft's photo
// (fetched from `photo`, e.g. a local http server), then opens Home.
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { useDb } from "@/db/DatabaseProvider";
import { createPage } from "@/db/repositories/pages";
import { SHOT_LANGS, seedStoreShots, STORE_SHOTS, type ShotLang } from "@/dev/storeShots";
import { useImageStore } from "@/images/ImageStoreProvider";
import { usePrefs } from "@/prefs/PrefsProvider";

export default function StoreShots() {
  const { lang, photo, w, h, today } = useLocalSearchParams<{ lang?: string; photo?: string; w?: string; h?: string; today?: string }>();
  const db = useDb();
  const images = useImageStore();
  const prefs = usePrefs();
  const [error, setError] = useState<string | null>(null);
  const l = (SHOT_LANGS as readonly string[]).includes(lang ?? "") ? (lang as ShotLang) : null;

  useEffect(() => {
    if (!l) return;
    (async () => {
      const set = STORE_SHOTS[l];
      const day = today ?? new Date().toISOString().slice(0, 10);
      const { draftId } = seedStoreShots(db, l, day);
      if (photo) {
        const bytes = new Uint8Array(await (await fetch(photo)).arrayBuffer());
        const path = await images.importPage(bytes);
        createPage(db, { receiptId: draftId, pageIndex: 0, imagePath: path, thumbPath: null, width: Number(w) || 1080, height: Number(h) || 1600, dhash: null });
      }
      prefs.set("language", set.language);
      prefs.set("homeCurrency", set.home);
      prefs.set("onboardingStep", "done");
      prefs.set("guideSeen", true);
      prefs.set("lockEnabled", false);
      prefs.set("receiptsSinceBackup", 0);
      console.log("STORE_SHOTS_DONE " + l);
      router.replace("/");
    })().catch((e: unknown) => {
      console.log("STORE_SHOTS_FAILED " + String(e));
      setError(String(e));
    });
  }, [db, images, prefs, l, photo, w, h, today]);

  return (
    <View style={{ padding: 24, paddingTop: 80 }}>
      <Text>{`Store shots: ${!l ? `unknown lang: ${lang}` : (error ?? "seeding…")}`}</Text>
    </View>
  );
}
