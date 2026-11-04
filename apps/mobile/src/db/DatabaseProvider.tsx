import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { DbErrorScreen } from "@/app/db-error";
import { MasterKeyCorruptError } from "@/crypto/keys";
import { expoSecretStore } from "@/crypto/secureStore";
import { deletePrefsStorage } from "@/prefs/storage";

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
  | { status: "failed"; message: string };

function Migrated({ db, children }: { db: AppDb; children: ReactNode }) {
  // useMigrations only needs the drizzle expo-sqlite handle's session/dialect.
  const { success, error } = useMigrations(db as unknown as Parameters<typeof useMigrations>[0], migrations);
  if (error) return <Message text={`Database migration failed: ${error.message}`} />;
  if (!success) return <Loading />;
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}

function Message({ text }: { text: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text selectable>{text}</Text>
    </View>
  );
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OpenState>({ status: "opening" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    openWithStore({ store: expoSecretStore }).then(
      (db) => {
        if (!cancelled) setState({ status: "ready", db });
      },
      (e) => {
        if (cancelled) return;
        if (e instanceof DbKeyMismatchError || e instanceof MasterKeyCorruptError) {
          setState({ status: "locked" });
        } else {
          setState({ status: "failed", message: e instanceof Error ? e.message : String(e) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Only path allowed to delete the DB and key; DbErrorScreen gates it behind typing RESET.
  // A failure shows an error state (no retry loop); the locked handle was already closed.
  const reset = useCallback(async () => {
    try {
      await resetLocalData({ store: expoSecretStore, wipePrefs: deletePrefsStorage });
    } catch (e) {
      setState({
        status: "failed",
        message: `Reset failed: ${e instanceof Error ? e.message : String(e)}`,
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
      return <Message text={`Could not open database: ${state.message}`} />;
    case "ready":
      return <Migrated db={state.db}>{children}</Migrated>;
  }
}
