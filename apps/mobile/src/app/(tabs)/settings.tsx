import { getLocales } from "expo-localization";
import { Link } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppModal } from "@/components/AppModal";
import { CurrencyPicker, currencyName } from "@/components/CurrencyPicker";
import { LANGUAGE_NAMES, LanguagePicker } from "@/components/LanguagePicker";
import { LockToggle } from "@/components/LockToggle";
import { OptionRow } from "@/components/OptionRow";
import { TaxYearPicker } from "@/components/TaxYearPicker";
import { resolveHomeCurrency, resolveLanguage } from "@/i18n/resolve";
import type { LockTimeout } from "@/prefs/prefs";
import { usePref, usePrefs } from "@/prefs/PrefsProvider";
import { useTheme } from "@/theme/ThemeProvider";

const TIMEOUTS: LockTimeout[] = [0, 60, 300, 900];

type Sheet = "language" | "currency" | "taxYear" | null;

function Row({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      onPress={onPress}
      style={{
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
      }}
    >
      <Text style={[theme.type.body, { color: theme.colors.text }]}>{label}</Text>
      <Text numberOfLines={1} style={[theme.type.body, { color: theme.colors.textMuted, flexShrink: 1 }]}>
        {value}
      </Text>
    </Pressable>
  );
}

function PickerSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <AppModal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.xl, paddingBottom: insets.bottom + theme.spacing.xl, gap: theme.spacing.lg }}>
        <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", flex: 1, gap: theme.spacing.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text accessibilityRole="header" style={[theme.type.title, { color: theme.colors.text }]}>
              {title}
            </Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 48, justifyContent: "center" }}>
              <Text style={[theme.type.body, { color: theme.colors.primary, fontWeight: "600" }]}>{t("common.done")}</Text>
            </Pressable>
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
  const insets = useSafeAreaInsets();
  const prefs = usePrefs();
  const [sheet, setSheet] = useState<Sheet>(null);

  const device = getLocales();
  const language = usePref("language") ?? resolveLanguage(device);
  const currency = usePref("homeCurrency") ?? resolveHomeCurrency(device);
  const taxYear = usePref("taxYearStartMonth");
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
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing.xl, paddingTop: insets.top + theme.spacing.xl }}
    >
      <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", gap: theme.spacing.md }}>
        <Text accessibilityRole="header" style={[theme.type.headline, { color: theme.colors.text }]}>
          {t("settings.title")}
        </Text>
        <Row label={t("settings.language")} value={LANGUAGE_NAMES[language]} onPress={() => setSheet("language")} />
        <Row
          label={t("settings.homeCurrency")}
          value={`${currency} ${currencyName(i18n.language, currency)}`.trim()}
          onPress={() => setSheet("currency")}
        />
        <Row label={t("settings.taxYearStart")} value={monthLabel(taxYear)} onPress={() => setSheet("taxYear")} />

        <View style={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm }}>
          <LockToggle label={t("settings.appLock")} value={lockEnabled} onChange={(v) => prefs.set("lockEnabled", v)} />
        </View>
        {lockEnabled ? (
          <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.sm }}>
            <Text style={[theme.type.caption, { color: theme.colors.textMuted }]}>{t("settings.lockTimeout")}</Text>
            {TIMEOUTS.map((s) => (
              <OptionRow key={s} label={timeoutLabel(s)} selected={s === lockTimeout} onPress={() => prefs.set("lockTimeout", s)} />
            ))}
          </View>
        ) : null}

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
    </ScrollView>
  );
}
