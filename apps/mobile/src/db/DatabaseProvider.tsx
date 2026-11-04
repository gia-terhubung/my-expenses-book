import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import { DbErrorScreen } from "@/components/DbErrorScreen";
import { ErrorPanel } from "@/components/ErrorPanel";
import { MasterKeyCorruptError } from "@/crypto/keys";
import { expoSecretStore } from "@/crypto/secureStore";
import { deletePrefsStorage } from "@/prefs/storage";
import { useTheme } from "@/theme/ThemeProvider";

import { DbKeyMismatchError, openWithStore, resetLocalData } from "./client";
import migrations from "./migrations/migrations";
import type { AppDb } from "./types";

const DbContext = createContext<AppDb | null>(null);

export function useDb(): AppDb {
  const db = useContext(DbContext);
  if (!db) throw new Error("useDb must be used inside <DatabaseProvider>");
  return db;
}

type OpenState =
  | { status: "opening" }
  | { status: "ready"; db: AppDb }
  | { status: "locked" } // data exists but cannot be unlocked: never auto-recover
  | { status: "failed"; titleKey: FailureKey; message: string };

type FailureKey = "dbError.openFailed" | "dbError.resetFailed";

function Migrated({
  db,
  onRetry,
  children,
}: {
  db: AppDb;
  onRetry: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  // useMigrations only needs the drizzle expo-sqlite handle's session/dialect.
  const { success, error } = useMigrations(db as unknown as Parameters<typeof useMigrations>[0], migrations);
  if (error) {
    return <ErrorPanel title={t("dbError.migrationFailed")} details={error.message} onRetry={onRetry} />;
  }
  if (!success) return <Loading />;
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

function Loading() {
  const theme = useTheme();
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

function closeDb(db: AppDb): void {
  try {
    (db as unknown as { $client: { closeSync(): void } }).$client.closeSync();
  } catch {
    // already closed
  }
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OpenState>({ status: "opening" });
  const [attempt, setAttempt] = useState(0);
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    let opened: AppDb | null = null;
    openWithStore({ store: expoSecretStore }).then(
      (db) => {
        if (cancelled) {
          closeDb(db);
          return;
        }
        opened = db;
        setState({ status: "ready", db });
      },
      (e) => {
        if (cancelled) return;
        if (e instanceof DbKeyMismatchError || e instanceof MasterKeyCorruptError) {
          setState({ status: "locked" });
        } else {
          setState({
            status: "failed",
            titleKey: "dbError.openFailed",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      },
    );
    return () => {
      cancelled = true;
      if (opened) closeDb(opened);
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "opening" });
    setAttempt((a) => a + 1);
  }, []);

  // Only path allowed to delete the DB and key; DbErrorScreen gates it behind typing RESET.
  // A failure shows an error state (no retry loop); the locked handle was already closed.
  const reset = useCallback(async () => {
    try {
      await resetLocalData({ store: expoSecretStore, wipePrefs: deletePrefsStorage });
    } catch (e) {
      setState({
        status: "failed",
        titleKey: "dbError.resetFailed",
        message: e instanceof Error ? e.message : String(e),
      });
      return;
    }
    setState({ status: "opening" });
    setAttempt((a) => a + 1);
  }, []);

  switch (state.status) {
    case "opening":
      return <Loading />;
    case "locked":
      return <DbErrorScreen onReset={reset} />;
    case "failed":
      return <ErrorPanel title={t(state.titleKey)} details={state.message} onRetry={retry} />;
    case "ready":
      return <Migrated db={state.db} onRetry={retry}>{children}</Migrated>;
  }
}
