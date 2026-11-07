import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AppState } from "react-native";

import { deriveKey, getOrCreateMasterKey } from "@/crypto/keys";
import { expoSecretStore } from "@/crypto/secureStore";
import { useDb } from "@/db/DatabaseProvider";
import { listAllPagePaths } from "@/db/repositories/pages";
import { purgeExportFiles } from "@/export/files";

import { captureLease } from "./captureLease";
import { purgeScopeOnAppState } from "./purgePolicy";
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
 * Export/picker files (`cache/export/`, `cache/DocumentPicker/`) are purged on mount only.
 * savePage waits for the orphan sweep so a page saved mid-sweep is never deleted.
 * While a capture holds `captureLease`, the background purge spares the capture's work files;
 * if the app is still in the background when the lease frees, the full purge runs then.
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
        // New page files (capture or restore) wait for the sweep so it cannot delete them unrecorded.
        setStore({
          ...base,
          savePage: async (uri) => (await sweep, base.savePage(uri)),
          importPage: async (plain) => (await sweep, base.importPage(plain)),
        });
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
    const purge = (opts?: { keepCaptureWork: boolean }) => {
      store.purgeDecryptedCache(opts).catch((e) => {
        if (__DEV__) console.warn("purgeDecryptedCache failed", e);
      });
    };
    purge({ keepCaptureWork: captureLease.held() });
    if (!captureLease.held()) {
      store.purgeCaptureSources().catch((e) => {
        if (__DEV__) console.warn("purgeCaptureSources failed", e);
      });
    }
    // Cold start only: plaintext exports and the document picker's backup copy. Deliberately not
    // in the background purge: the share sheet / picker backgrounds the app while the receiving
    // app still has to read the file.
    purgeExportFiles(expoFs).catch((e) => {
      if (__DEV__) console.warn("purgeExportFiles failed", e);
    });
    const sub = AppState.addEventListener("change", (s) => {
      const scope = purgeScopeOnAppState(s, captureLease.held());
      if (scope) purge(scope);
    });
    const offFree = captureLease.onFree(() => {
      const scope = purgeScopeOnAppState(AppState.currentState ?? "active", false);
      if (scope) purge(scope);
    });
    return () => {
      sub.remove();
      offFree();
    };
  }, [store]);

  if (!store) return null;
  return <ImageStoreContext.Provider value={store}>{children}</ImageStoreContext.Provider>;
}
