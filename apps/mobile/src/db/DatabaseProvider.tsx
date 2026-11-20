import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from "react-native";

import { DbErrorScreen } from "@/components/DbErrorScreen";
import { ErrorPanel } from "@/components/ErrorPanel";
import { MasterKeyCorruptError } from "@/crypto/keys";
import { expoSecretStore } from "@/crypto/secureStore";
import { deletePagesDir } from "@/images/expoFs";
import { deletePrefsStorage } from "@/prefs/storage";
import { useTheme } from "@/theme/ThemeProvider";

import { DbKeyMismatchError, dbFilePath, deleteDatabaseFiles, openWithStore, resetLocalData } from "./client";
import { expoDbFiles } from "./expoDbFiles";
import migrations from "./migrations/migrations";
import { pendingMigrationCount, preUpgradePath, safeMigrate } from "./safeMigrate";
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

type MigrateState =
  | { status: "running" }
  | { status: "ok" }
  | { status: "failed"; titleKey: MigrateFailureKey; scope: string; message: string };

type MigrateFailureKey =
  | "dbError.migrationFailed"
  | "dbError.migrationRestored"
  | "dbError.noSpace"
  | "dbError.openFailed";

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

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
  const [state, setState] = useState<MigrateState>({ status: "running" });

  useEffect(() => {
    let cancelled = false;
    // After a restore the original handle is closed; this one holds the restored file until Retry.
    let reopened: AppDb | null = null;
    let reopenFailed = false;
    safeMigrate({
      db,
      dbPath: dbFilePath(),
      files: expoDbFiles,
      pendingCount: pendingMigrationCount(migrations.journal),
      // migrate only needs the drizzle expo-sqlite handle's session/dialect.
      runMigrations: (d) => migrate(d as unknown as Parameters<typeof migrate>[0], migrations),
      close: closeForRestore,
      reopen: async () => {
        try {
          return await openWithStore({ store: expoSecretStore });
        } catch (e) {
          reopenFailed = true;
          throw e;
        }
      },
    }).then(
      (outcome) => {
        if (outcome.status === "restored") reopened = outcome.db;
        if (cancelled) {
          if (reopened) closeDb(reopened);
          return;
        }
        if (outcome.status === "ok") {
          setState({ status: "ok" });
          return;
        }
        setState({
          status: "failed",
          titleKey: outcome.status === "restored" ? "dbError.migrationRestored" : "dbError.noSpace",
          scope: "db.migrate",
          message: errorMessage(outcome.error),
        });
      },
      (e) => {
        if (cancelled) return;
        setState({
          status: "failed",
          titleKey: reopenFailed ? "dbError.openFailed" : "dbError.migrationFailed",
          scope: reopenFailed ? "db.open" : "db.migrate",
          message: errorMessage(e),
        });
      },
    );
    return () => {
      cancelled = true;
      if (reopened) closeDb(reopened);
    };
  }, [db]);

  if (state.status === "failed") {
    return <ErrorPanel title={t(state.titleKey)} details={state.message} onRetry={onRetry} scope={state.scope} />;
  }
  if (state.status === "running") return <Loading />;
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

/**
 * The restore's close: throws unless the handle is closed afterwards, because safeMigrate then
 * moves the pre-upgrade copy over the file. A handle that was already closed is fine.
 */
function closeForRestore(db: AppDb): void {
  try {
    (db as unknown as { $client: { closeSync(): void } }).$client.closeSync();
  } catch (e) {
    // expo-sqlite's AccessClosedResourceException (iOS and Android).
    if (/access to closed resource/i.test(errorMessage(e))) return;
    throw e;
  }
}

/**
 * Reset's file wipe. The pre-upgrade copy goes first: a copy left next to a wiped DB would be
 * restored on the next launch. If removing it fails, the DB is still intact.
 */
function deleteDbAndCopies(): void {
  const path = dbFilePath();
  expoDbFiles.remove(preUpgradePath(path));
  expoDbFiles.remove(`${path}.restoring`);
  deleteDatabaseFiles();
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
      await resetLocalData({
        store: expoSecretStore,
        wipePrefs: deletePrefsStorage,
        wipeImages: deletePagesDir,
        deleteFiles: deleteDbAndCopies,
      });
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
      return <ErrorPanel title={t(state.titleKey)} details={state.message} onRetry={retry} scope="db.open" />;
    case "ready":
      return <Migrated db={state.db} onRetry={retry}>{children}</Migrated>;
  }
}
