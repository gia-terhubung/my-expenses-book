import { getLocales } from "expo-localization";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";

import { getOrCreateMasterKey } from "@/crypto/keys";
import { expoSecretStore } from "@/crypto/secureStore";
import { setLanguage } from "@/i18n";
import { resolveLanguage } from "@/i18n/resolve";

import { useTheme } from "@/theme/ThemeProvider";

import { prefsEncryptionKey } from "./mmkvKey";
import { usePrefFrom, type Prefs, type PrefsStore } from "./prefs";
import { openPrefs } from "./storage";

const PrefsContext = createContext<PrefsStore | null>(null);

export function usePrefs(): PrefsStore {
  const store = useContext(PrefsContext);
  if (!store) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return store;
}

export function usePref<K extends keyof Prefs>(k: K): Prefs[K] {
  return usePrefFrom(usePrefs(), k);
}

/**
 * Opens encrypted prefs with the key derived from the shared master key (memoized per store,
 * so no second derivation races DatabaseProvider). Mount inside DatabaseProvider: a RESET
 * unmounts it, and the remount re-opens prefs under the new master key.
 */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<PrefsStore | null>(null);
  const [error, setError] = useState<unknown>(null);
  const theme = useTheme();
  // Re-throw into render so the root ErrorBoundary (with Retry) shows it; never a blank app.
  if (error) throw error;

  useEffect(() => {
    let cancelled = false;
    getOrCreateMasterKey(expoSecretStore).then(
      (master) => {
        if (!cancelled) setStore(openPrefs(prefsEncryptionKey(master)));
      },
      (e) => {
        if (!cancelled) setError(e);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Apply the saved language (or the device default) and follow later changes.
  useEffect(() => {
    if (!store) return;
    const apply = () => setLanguage(store.get("language") ?? resolveLanguage(getLocales()));
    apply();
    return store.subscribe("language", apply);
  }, [store]);

  if (!store) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }
  return <PrefsContext.Provider value={store}>{children}</PrefsContext.Provider>;
}
