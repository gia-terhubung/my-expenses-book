import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AppState } from "react-native";

import { deriveKey, getOrCreateMasterKey } from "@/crypto/keys";
import { expoSecretStore } from "@/crypto/secureStore";
import { useDb } from "@/db/DatabaseProvider";
import { listAllPagePaths } from "@/db/repositories/pages";

import { shouldPurgeOnAppState } from "./purgePolicy";
import { expoFs } from "./expoFs";
import { expoManipulate } from "./expoManipulate";
import { createImageStore, type ImageStore } from "./store";

const ImageStoreContext = createContext<ImageStore | null>(null);

export function useImageStore(): ImageStore {
  const store = useContext(ImageStoreContext);
  if (!store) throw new Error("useImageStore must be used inside <ImageStoreProvider>");
  return store;
}

/**
 * Derives the images key once, sweeps orphaned encrypted pages after the DB is open, and keeps
 * decrypted view files out of cache (purged on mount and whenever the app goes to `background`, not `inactive`).
 * savePage waits for the orphan sweep so a page saved mid-sweep is never deleted.
 * Mount inside DatabaseProvider: a RESET unmounts it and the remount uses the new master key.
 */
export function ImageStoreProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const [store, setStore] = useState<ImageStore | null>(null);
  const [error, setError] = useState<unknown>(null);
  // Re-throw into render so the root ErrorBoundary (with Retry) shows it.
  if (error) throw error;

  useEffect(() => {
    let cancelled = false;
    getOrCreateMasterKey(expoSecretStore).then(
      (master) => {
        if (cancelled) return;
        const base = createImageStore({
          key: deriveKey(master, "images"),
          fs: expoFs,
          manipulate: expoManipulate,
        });
        // Cleanup failure must not block the app; orphans are retried on the next launch.
        const sweep = base.cleanupOrphanPages(listAllPagePaths(db)).then(
          () => undefined,
          (e) => {
            if (__DEV__) console.warn("cleanupOrphanPages failed", e);
          },
        );
        setStore({ ...base, savePage: async (uri) => (await sweep, base.savePage(uri)) });
      },
      (e) => {
        if (!cancelled) setError(e);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db]);

  useEffect(() => {
    if (!store) return;
    const purge = () => {
      store.purgeDecryptedCache().catch((e) => {
        if (__DEV__) console.warn("purgeDecryptedCache failed", e);
      });
    };
    purge();
    const sub = AppState.addEventListener("change", (s) => {
      if (shouldPurgeOnAppState(s)) purge();
    });
    return () => sub.remove();
  }, [store]);

  if (!store) return null;
  return <ImageStoreContext.Provider value={store}>{children}</ImageStoreContext.Provider>;
}
