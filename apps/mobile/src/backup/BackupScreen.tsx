import * as DocumentPicker from "expo-document-picker";
import Constants from "expo-constants";
import { router, usePreventRemove, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { dateToLocalString } from "@/components/dateString";
import { ErrorPanel } from "@/components/ErrorPanel";
import { useDb } from "@/db/DatabaseProvider";
import { getReceipt } from "@/db/repositories/receipts";
import { formatMoney } from "@/money/money";
import {
  EXPORT_DIR,
  exportFileName,
  purgeExportDir,
  shareFile,
} from "@/export/files";
import { captureLease } from "@/images/captureLease";
import { expoFs } from "@/images/expoFs";
import { useImageStore } from "@/images/ImageStoreProvider";
import type { FileOps } from "@/images/store";
import { usePref, usePrefs } from "@/prefs/PrefsProvider";
import { useTheme } from "@/theme/ThemeProvider";

import { openArchive, type ArchiveHeader } from "./container";
import {
  ArchiveFormatError,
  ArchiveIncompleteError,
  ArchiveTooOldError,
  ArchiveVersionError,
  WrongPassphraseError,
} from "./errors";
import { fileOpsSink, fileSource } from "./expoBytes";
import { exportBackup } from "./exportBackup";
import {
  importBackup,
  type RestoreMode,
} from "./importBackup";
import { validatePassphrase } from "./passphrase";
import { MIN_PASSPHRASE } from "./kdf";
import { restoreLease } from "./restoreLease";

type Stage =
  | { kind: "idle" }
  | { kind: "passphrase"; header: ArchiveHeader }
  | { kind: "choose"; header: ArchiveHeader }
  | {
      kind: "done";
      mode: RestoreMode;
      inserted: number;
      updated: number;
      duplicates: { id: string; label: string }[];
    };

type Unlockable = Awaited<ReturnType<typeof openArchive>>;

function ActionButton({
  label,
  onPress,
  busy,
  disabled,
  primary,
  hint,
}: {
  label: string;
  onPress: () => void;
  busy: boolean;
  disabled?: boolean;
  primary?: boolean;
  hint?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled ?? false, busy }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 48,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor: primary ? theme.colors.primary : "transparent",
        borderWidth: primary ? 0 : 1,
        borderColor: theme.colors.border,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        style={[
          theme.type.body,
          {
            color: primary ? theme.colors.onPrimary : theme.colors.text,
            fontWeight: "600",
          },
        ]}
      >
        {label}
      </Text>
      {hint ? (
        <Text
          style={[
            theme.type.caption,
            {
              color: primary ? theme.colors.onPrimary : theme.colors.textMuted,
            },
          ]}
        >
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Back up to a (usually passphrase-protected) .meb file and share it, or restore from one.
 * The passphrase lives in component state only and is cleared after every attempt.
 */
export function BackupScreen({
  fs = expoFs,
  now = () => new Date(),
}: {
  fs?: FileOps;
  now?: () => Date;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language || "en";
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const store = useImageStore();
  const prefs = usePrefs();
  const lastBackupAt = usePref("lastBackupAt");
  const today = useMemo(() => dateToLocalString(now()), [now]);

  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<{ title: string; details: string } | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [restorePass, setRestorePass] = useState("");
  const [wrong, setWrong] = useState(false);

  const fsRef = useRef(fs);
  const inflight = useRef(false);
  /** True for the whole importBackup call; the unmount cleanup then leaves the picked file to it. */
  const importing = useRef(false);
  const pickedUri = useRef<string | null>(null);
  const firstHandle = useRef<{
    close(): Promise<void>;
    archive: Unlockable;
  } | null>(null);

  const validity = validatePassphrase(pass, confirm);
  const started = pass.length > 0 || confirm.length > 0;
  const passMsg =
    started && validity === "tooShort"
      ? t("backup.tooShort", { count: MIN_PASSPHRASE })
      : confirm.length > 0 && validity === "mismatch"
        ? t("backup.mismatch")
        : null;

  // Leaving mid-backup / mid-restore would orphan files or race the post-commit cleanup: block
  // Android back, the header back button and the iOS swipe until the work settles.
  usePreventRemove(busy, () => Alert.alert(t("backup.waitToLeave")));

  // A picked backup is open (passphrase / choose): a backup now must not run alongside it.
  const restoreOpen = stage.kind === "passphrase" || stage.kind === "choose";

  const fail = (title: string, e: unknown) =>
    setError({ title, details: e instanceof Error ? e.message : String(e) });

  const backup = async (passphrase: string | null) => {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    setProgress(null);
    let uri: string | null = null;
    try {
      await purgeExportDir(fs);
      uri = fs.cacheDir + EXPORT_DIR + exportFileName("meb", today);
      const at = now().getTime();
      await exportBackup({
        db,
        prefs,
        store,
        sink: fileOpsSink(uri),
        passphrase,
        now: at,
        appVersion: Constants.expoConfig?.version ?? "0.0.0",
        onProgress: (done, total) => setProgress({ done, total }),
      });
      const shared = uri;
      uri = null;
      try {
        await shareFile(shared, "meb");
      } catch (e) {
        await fs.remove(shared).catch(() => undefined);
        throw e;
      }
      prefs.set("lastBackupAt", at);
      prefs.set("receiptsSinceBackup", 0);
    } catch (e) {
      if (uri) await fs.remove(uri).catch(() => undefined);
      fail(t("backup.failed"), e);
    } finally {
      setPass("");
      setConfirm("");
      setProgress(null);
      setBusy(false);
      inflight.current = false;
    }
  };

  const skipPassphrase = () =>
    Alert.alert(t("backup.skip"), t("backup.skipWarn"), [
      { text: t("backup.cancel"), style: "cancel" },
      {
        text: t("backup.skipConfirm"),
        style: "destructive",
        onPress: () => void backup(null),
      },
    ]);

  /** Ends the restore flow: closes the first handle, deletes the picker copy, clears secrets. */
  const endRestore = async () => {
    const h = firstHandle.current;
    firstHandle.current = null;
    await h?.close().catch(() => undefined);
    const uri = pickedUri.current;
    pickedUri.current = null;
    if (uri) await fs.remove(uri).catch(() => undefined);
    setRestorePass("");
    setWrong(false);
  };

  useEffect(
    () => () => {
      const h = firstHandle.current;
      firstHandle.current = null;
      void h?.close().catch(() => undefined);
      // Mid-import the file is still being read; runRestore's finally deletes it.
      if (importing.current) return;
      const uri = pickedUri.current;
      pickedUri.current = null;
      if (uri) void fsRef.current.remove(uri).catch(() => undefined);
    },
    [],
  );

  const restoreError = (e: unknown) => {
    if (e instanceof ArchiveFormatError) setNotice(t("backup.notBackup"));
    else if (e instanceof ArchiveVersionError) setNotice(t("backup.tooNew"));
    else if (e instanceof ArchiveTooOldError) setNotice(t("backup.tooOld"));
    else if (e instanceof ArchiveIncompleteError)
      setNotice(t("backup.damaged"));
    else fail(t("backup.restoreFailed"), e);
  };

  const pick = async () => {
    if (inflight.current) return;
    setNotice(null);
    setError(null);
    if (captureLease.held()) {
      setNotice(t("backup.scanFirst"));
      return;
    }
    inflight.current = true;
    setBusy(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      pickedUri.current = res.assets[0].uri;
      const source = fileSource(pickedUri.current);
      let archive: Unlockable;
      try {
        archive = await openArchive(source);
      } catch (e) {
        await source.close().catch(() => undefined);
        throw e;
      }
      firstHandle.current = { close: () => source.close(), archive };
      if (archive.header.encrypted) {
        setStage({ kind: "passphrase", header: archive.header });
      } else {
        await firstHandle.current.close();
        firstHandle.current = null;
        setStage({ kind: "choose", header: archive.header });
      }
    } catch (e) {
      await endRestore();
      restoreError(e);
    } finally {
      setBusy(false);
      inflight.current = false;
    }
  };

  const unlock = async () => {
    const h = firstHandle.current;
    if (inflight.current || !h || stage.kind !== "passphrase") return;
    inflight.current = true;
    setBusy(true);
    setWrong(false);
    try {
      await h.archive.unlock(restorePass);
      await h.close().catch(() => undefined);
      firstHandle.current = null;
      setStage({ kind: "choose", header: stage.header });
    } catch (e) {
      if (e instanceof WrongPassphraseError) {
        setWrong(true);
        setRestorePass("");
      } else {
        await endRestore();
        setStage({ kind: "idle" });
        restoreError(e);
      }
    } finally {
      setBusy(false);
      inflight.current = false;
    }
  };

  const cancelRestore = async () => {
    await endRestore();
    setStage({ kind: "idle" });
  };

  const runRestore = async (mode: RestoreMode) => {
    const uri = pickedUri.current;
    if (inflight.current || !uri) return;
    if (captureLease.held()) {
      setNotice(t("backup.scanFirst"));
      return;
    }
    inflight.current = true;
    importing.current = true;
    const releaseLease = restoreLease.acquire();
    setBusy(true);
    setProgress(null);
    try {
      const { result, possibleDuplicates } = await importBackup({
        db,
        prefs,
        store,
        source: fileSource(uri),
        passphrase:
          stage.kind === "choose" && stage.header.encrypted
            ? restorePass
            : null,
        mode,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      // The import is committed: nothing below may turn it into a "Restore failed".
      const duplicates: { id: string; label: string }[] = [];
      for (const d of possibleDuplicates) {
        try {
          const r = getReceipt(db, d.receiptId);
          if (!r) continue;
          const name = r.merchant ?? t("receipts.unknownMerchant");
          let label = name;
          try {
            const [y, m, day] = r.purchasedAtLocal
              .slice(0, 10)
              .split("-")
              .map(Number);
            const date = new Date(y, m - 1, day).toLocaleDateString(locale);
            label = `${name} · ${date} · ${formatMoney(r.totalMinor, r.currency, locale)}`;
          } catch {
            // Fallback label: the merchant (or "unknown") alone.
          }
          duplicates.push({ id: r.id, label });
        } catch {
          // Unreadable row: leave it out of the list.
        }
      }
      setStage({
        kind: "done",
        mode,
        inserted: result.inserted,
        updated: result.updated,
        duplicates,
      });
    } catch (e) {
      setStage({ kind: "idle" });
      restoreError(e);
    } finally {
      releaseLease();
      importing.current = false;
      await endRestore();
      setProgress(null);
      setBusy(false);
      inflight.current = false;
    }
  };

  const confirmReplace = () =>
    Alert.alert(t("backup.replace"), t("backup.replaceWarn"), [
      { text: t("backup.cancel"), style: "cancel" },
      {
        text: t("backup.replaceConfirm"),
        style: "destructive",
        onPress: () => void runRestore("replace"),
      },
    ]);

  if (error !== null) {
    return (
      <ErrorPanel
        title={error.title}
        details={error.details}
        onRetry={() => setError(null)}
        scope="backup"
      />
    );
  }

  const section = (title: string) => (
    <Text
      accessibilityRole="header"
      style={[theme.type.headline, { color: theme.colors.text }]}
    >
      {title}
    </Text>
  );
  const input = (
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) => (
    <TextInput
      accessibilityLabel={label}
      placeholder={label}
      placeholderTextColor={theme.colors.textMuted}
      value={value}
      onChangeText={onChange}
      secureTextEntry
      autoComplete="off"
      autoCapitalize="none"
      autoCorrect={false}
      style={[
        theme.type.body,
        {
          minHeight: 48,
          paddingHorizontal: theme.spacing.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          color: theme.colors.text,
        },
      ]}
    />
  );
  const small = (text: string, color: string, testID?: string) => (
    <Text
      testID={testID}
      accessibilityLiveRegion="polite"
      style={[theme.type.caption, { color }]}
    >
      {text}
    </Text>
  );

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{
        padding: theme.spacing.xl,
        paddingTop: theme.spacing.lg,
        paddingBottom: insets.bottom + theme.spacing.xl,
      }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 560,
          alignSelf: "center",
          gap: theme.spacing.md,
        }}
      >
        {section(t("backup.backupHeading"))}
        <Text style={[theme.type.body, { color: theme.colors.text }]}>
          {lastBackupAt
            ? t("backup.lastBackup", {
                date: new Date(lastBackupAt).toLocaleDateString(locale),
              })
            : t("backup.never")}
        </Text>
        {input(t("backup.passphrase"), pass, setPass)}
        {input(t("backup.confirm"), confirm, setConfirm)}
        {passMsg
          ? small(passMsg, theme.colors.danger)
          : small(
              t("backup.hint", { count: MIN_PASSPHRASE }),
              theme.colors.textMuted,
            )}
        <ActionButton
          label={
            busy && progress
              ? t("backup.progress", progress)
              : busy
                ? t("backup.busy")
                : t("backup.run")
          }
          onPress={() => void backup(pass)}
          busy={busy}
          disabled={busy || restoreOpen || validity !== "ok"}
          primary
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("backup.skip")}
          accessibilityState={{ disabled: busy || restoreOpen }}
          disabled={busy || restoreOpen}
          onPress={skipPassphrase}
          style={{
            minHeight: 48,
            justifyContent: "center",
            alignItems: "center",
            opacity: busy || restoreOpen ? 0.5 : 1,
          }}
        >
          <Text style={[theme.type.body, { color: theme.colors.primary }]}>
            {t("backup.skip")}
          </Text>
        </Pressable>

        {section(t("backup.restoreHeading"))}
        {notice ? small(notice, theme.colors.danger) : null}

        {stage.kind === "idle" ? (
          <ActionButton
            label={t("backup.restore")}
            onPress={() => void pick()}
            busy={busy}
            disabled={busy}
          />
        ) : null}

        {stage.kind === "passphrase" ? (
          <View style={{ gap: theme.spacing.md }}>
            {input(t("backup.enterPassphrase"), restorePass, setRestorePass)}
            {wrong
              ? small(t("backup.wrongPassphrase"), theme.colors.danger)
              : null}
            <ActionButton
              label={t("backup.unlock")}
              onPress={() => void unlock()}
              busy={busy}
              disabled={busy || restorePass.length === 0}
              primary
            />
            <ActionButton
              label={t("backup.cancel")}
              onPress={() => void cancelRestore()}
              busy={busy}
              disabled={busy}
            />
          </View>
        ) : null}

        {stage.kind === "choose" ? (
          <View style={{ gap: theme.spacing.md }}>
            {!stage.header.encrypted
              ? small(t("backup.unprotected"), theme.colors.textMuted)
              : null}
            {busy
              ? small(
                  progress
                    ? t("backup.progress", progress)
                    : t("backup.restoring"),
                  theme.colors.textMuted,
                )
              : null}
            <ActionButton
              label={t("backup.merge")}
              onPress={() => void runRestore("merge")}
              busy={busy}
              disabled={busy}
              primary
              hint={t("backup.mergeHint")}
            />
            <ActionButton
              label={t("backup.replace")}
              onPress={confirmReplace}
              busy={busy}
              disabled={busy}
              hint={t("backup.replaceHint")}
            />
            <ActionButton
              label={t("backup.cancel")}
              onPress={() => void cancelRestore()}
              busy={busy}
              disabled={busy}
            />
          </View>
        ) : null}

        {stage.kind === "done" ? (
          <View style={{ gap: theme.spacing.md }}>
            <Text
              accessibilityLiveRegion="polite"
              style={[theme.type.headline, { color: theme.colors.text }]}
            >
              {stage.mode === "replace"
                ? t("backup.resultReplace", { count: stage.inserted })
                : t("backup.resultMerge", {
                    inserted: stage.inserted,
                    updated: stage.updated,
                  })}
            </Text>
            {stage.duplicates.length > 0 ? (
              <View style={{ gap: theme.spacing.sm }}>
                {section(
                  t("backup.duplicates", { count: stage.duplicates.length }),
                )}
                {stage.duplicates.map((d) => (
                  <Pressable
                    key={d.id}
                    testID={`dup-${d.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={d.label}
                    onPress={() =>
                      router.push({
                        pathname: "/document/[id]",
                        params: { id: d.id },
                      } as unknown as Href)
                    }
                    style={{ minHeight: 48, justifyContent: "center" }}
                  >
                    <Text
                      style={[theme.type.body, { color: theme.colors.primary }]}
                    >
                      {d.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <ActionButton
              label={t("backup.done")}
              onPress={() => setStage({ kind: "idle" })}
              busy={busy}
            />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
