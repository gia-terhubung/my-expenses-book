import Ionicons from "@expo/vector-icons/Ionicons";
import { getLocales } from "expo-localization";
import Constants from "expo-constants";
import { Link, router, useFocusEffect, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PRIVACY_POLICY_URL } from "@/about/links";
import { formatBytes, storageStats, type StorageStats } from "@/about/storageStats";
import { AppModal } from "@/components/AppModal";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CurrencyPicker, currencyLabel } from "@/components/CurrencyPicker";
import { LANGUAGE_NAMES, LanguagePicker } from "@/components/LanguagePicker";
import { LockToggle } from "@/components/LockToggle";
import { OptionRow } from "@/components/OptionRow";
import { TaxYearPicker } from "@/components/TaxYearPicker";
import { InfoButton } from "@/guide/InfoButton";
import type { InfoTopic } from "@/guide/info";
import { InfoText } from "@/guide/InfoText";
import { MonthStartPicker } from "@/settings/MonthStartPicker";
import { useDb } from "@/db/DatabaseProvider";
import { fileSize } from "@/images/expoFs";
import { StatusBarInset } from "@/layout/StatusBarInset";
import { useTabBarSpace } from "@/layout/useTabBarSpace";
import { resolveHomeCurrency, resolveLanguage } from "@/i18n/resolve";
import type { LockTimeout } from "@/prefs/prefs";
import { usePref, usePrefs } from "@/prefs/PrefsProvider";
import { useSheetTopInset } from "@/layout/useSheetTopInset";
import { useTheme } from "@/theme/ThemeProvider";

const TIMEOUTS: LockTimeout[] = [0, 60, 300, 900];

type Sheet = "language" | "currency" | "taxYear" | "monthStart" | null;

function Row({ label, value, onPress, info }: { label: string; value: string; onPress: () => void; info?: InfoTopic }) {
  const theme = useTheme();
  const card = (
    <Card accessibilityLabel={value ? `${label}, ${value}` : label} onPress={onPress} style={{ justifyContent: "space-between" }}>
      <Text style={[theme.type.body, { color: theme.colors.text }]}>{label}</Text>
      {value ? (
        <Text numberOfLines={1} style={[theme.type.body, { color: theme.colors.textMuted, flexShrink: 1 }]}>
          {value}
        </Text>
      ) : (
        // Decorative: the row's role already says it opens something.
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[theme.type.body, { color: theme.colors.textMuted }]}
        >
          ›
        </Text>
      )}
    </Card>
  );
  if (!info) return card;
  // The (i) is its own target beside the row, so the row stays one press target for its picker.
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.xs }}>
      <View style={{ flex: 1 }}>{card}</View>
      <InfoButton topic={info} />
    </View>
  );
}

/** The one highlighted row: yellow fill with ink text (12:1), never yellow text. */
function TipRow({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  const ink = theme.colors.onHighlight;
  return (
    <Card tone="highlight" accessibilityLabel={label} onPress={onPress}>
      <View testID="settings-tip-icon" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name="cafe" size={22} color={ink} />
      </View>
      <Text style={[theme.type.label, { color: ink, flex: 1 }]}>{label}</Text>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={[theme.type.body, { color: ink }]}>
        ›
      </Text>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <Card accessible accessibilityLabel={`${label}, ${value}`} style={{ justifyContent: "space-between" }}>
      <Text style={[theme.type.body, { color: theme.colors.text }]}>{label}</Text>
      <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{value}</Text>
    </Card>
  );
}

function GroupTitle({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <Text accessibilityRole="header" style={[theme.type.caption, { color: theme.colors.textMuted, marginTop: theme.spacing.lg }]}>
      {title}
    </Text>
  );
}

function PickerSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const sheetTop = useSheetTopInset();
  return (
    <AppModal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.xl, paddingTop: sheetTop + theme.spacing.xl, paddingBottom: insets.bottom + theme.spacing.xl, gap: theme.spacing.lg }}>
        <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", flex: 1, gap: theme.spacing.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text accessibilityRole="header" style={[theme.type.title, { color: theme.colors.text }]}>
              {title}
            </Text>
            <Button variant="quiet" label={t("common.done")} onPress={onClose} />
          </View>
          {children}
        </View>
      </View>
    </AppModal>
  );
}

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const prefs = usePrefs();
  const [sheet, setSheet] = useState<Sheet>(null);
  const tabBarSpace = useTabBarSpace();
  const db = useDb();
  const [storage, setStorage] = useState<StorageStats | null>(null);
  useFocusEffect(
    useCallback(() => {
      let live = true;
      storageStats(db, fileSize)
        .then((s) => live && setStorage(s))
        .catch(() => {});
      return () => {
        live = false;
      };
    }, [db]),
  );

  const device = getLocales();
  const language = usePref("language") ?? resolveLanguage(device);
  const currency = usePref("homeCurrency") ?? resolveHomeCurrency(device);
  const taxYear = usePref("taxYearStartMonth");
  const monthStart = usePref("monthStartDay") ?? 1;
  const lockEnabled = usePref("lockEnabled");
  const lockTimeout = usePref("lockTimeout");

  const monthLabel = (m: number) => {
    try {
      return new Date(2000, m - 1, 1).toLocaleDateString(language, { month: "long" });
    } catch {
      return String(m);
    }
  };
  const timeoutLabel = (s: LockTimeout) =>
    s === 0 ? t("settings.lockTimeoutImmediately") : t("settings.lockTimeoutMinutes", { count: s / 60 });
  const close = () => setSheet(null);

  return (
    <StatusBarInset>
      <ScrollView
        style={{ backgroundColor: theme.colors.background }}
        contentContainerStyle={{ padding: theme.spacing.xl, paddingBottom: tabBarSpace || theme.spacing.xl }}
      >
        <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: theme.spacing.md }}>
          <Text accessibilityRole="header" style={[theme.type.headline, { color: theme.colors.text }]}>
            {t("settings.title")}
          </Text>
          <Row label={t("settings.language")} value={LANGUAGE_NAMES[language]} onPress={() => setSheet("language")} />
          <Row
            label={t("settings.homeCurrency")}
            value={currencyLabel(i18n.language, currency)}
            onPress={() => setSheet("currency")}
            info="homeCurrency"
          />
          <Row label={t("settings.taxYearStart")} value={monthLabel(taxYear)} onPress={() => setSheet("taxYear")} info="taxYear" />
          <Row
            label={t("settings.monthStart")}
            value={t("settings.monthStartValue", { n: monthStart })}
            onPress={() => setSheet("monthStart")}
            info="payCycle"
          />
          <Row label={t("settings.categories")} value="" onPress={() => router.push("/categories" as unknown as Href)} />
          <Row label={t("recurring.title")} value="" onPress={() => router.push("/recurring" as unknown as Href)} />
          <Row label={t("settings.export")} value="" onPress={() => router.push("/export" as unknown as Href)} />
          {/* /backup is created in the backup task. */}
          <Row label={t("settings.backupRestore")} value="" onPress={() => router.push("/backup" as unknown as Href)} />

          <Card style={{ flexDirection: "column", alignItems: "stretch" }}>
            <LockToggle label={t("settings.appLock")} value={lockEnabled} onChange={(v) => prefs.set("lockEnabled", v)} />
          </Card>
          {lockEnabled ? (
            <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>{t("settings.lockTimeout")}</Text>
                <InfoButton topic="lockAfter" />
              </View>
              {TIMEOUTS.map((s) => (
                <OptionRow key={s} label={timeoutLabel(s)} selected={s === lockTimeout} onPress={() => prefs.set("lockTimeout", s)} />
              ))}
            </View>
          ) : null}
          <InfoRow
            label={t("settings.storage")}
            value={storage ? t("settings.storageValue", { count: storage.receipts, size: formatBytes(storage.bytes, i18n.language) }) : "…"}
          />

          <GroupTitle title={t("settings.help")} />
          <Row label={t("settings.showGuide")} value="" onPress={() => router.push("/guide" as unknown as Href)} />

          <GroupTitle title={t("settings.support")} />
          <TipRow label={t("settings.tipJar")} onPress={() => router.push("/tip-jar" as unknown as Href)} />
          <Row label={t("settings.errorLog")} value="" onPress={() => router.push("/error-log" as unknown as Href)} />

          <GroupTitle title={t("about.title")} />
          <Row label={t("about.privacyPolicy")} value="" onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)} />
          <InfoRow label={t("about.version")} value={Constants.expoConfig?.version ?? "?"} />

          {__DEV__ && (
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xl }}>
              <Text style={[theme.type.title, { color: theme.colors.text }]}>{t("settings.devTools")}</Text>
              <Link href="/db-spike">DB spike</Link>
              <Link href="/ai-spike">AI spike</Link>
              <Link href="/db-check">DB check</Link>
              <Link href="/ocr-check">OCR check</Link>
            </View>
          )}
        </View>

        {sheet === "language" && (
          <PickerSheet title={t("settings.language")} onClose={close}>
            <LanguagePicker value={language} onChange={(l) => prefs.set("language", l)} />
          </PickerSheet>
        )}
        {sheet === "currency" && (
          <PickerSheet title={t("settings.homeCurrency")} onClose={close}>
            <CurrencyPicker lang={i18n.language} value={currency} onChange={(c) => prefs.set("homeCurrency", c)} />
          </PickerSheet>
        )}
        {sheet === "taxYear" && (
          <PickerSheet title={t("settings.taxYearStart")} onClose={close}>
            <ScrollView>
              <TaxYearPicker lang={language} value={taxYear} onChange={(m) => prefs.set("taxYearStartMonth", m)} />
            </ScrollView>
          </PickerSheet>
        )}
        {sheet === "monthStart" && (
          <PickerSheet title={t("settings.monthStart")} onClose={close}>
            <ScrollView contentContainerStyle={{ gap: theme.spacing.lg }}>
              <MonthStartPicker value={monthStart} onChange={(d) => prefs.set("monthStartDay", d)} />
              <InfoText topic="payCycle" showSummary />
            </ScrollView>
          </PickerSheet>
        )}
      </ScrollView>
    </StatusBarInset>
  );
}
