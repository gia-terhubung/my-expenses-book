import { getLocales } from "expo-localization";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CurrencyPicker } from "@/components/CurrencyPicker";
import { LanguagePicker } from "@/components/LanguagePicker";
import { LockToggle } from "@/components/LockToggle";
import { defaultTaxYearStartMonth, resolveHomeCurrency, resolveLanguage } from "@/i18n/resolve";
import { usePref, usePrefs } from "@/prefs/PrefsProvider";
import { StatusBarInset } from "@/layout/StatusBarInset";
import { useTheme } from "@/theme/ThemeProvider";

import { nextStep } from "./steps";

function Button({ label, onPress, primary = true }: { label: string; onPress: () => void; primary?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: theme.radius.pill,
        backgroundColor: primary ? theme.colors.primary : "transparent",
      }}
    >
      <Text style={[theme.type.body, { fontWeight: "600", color: primary ? theme.colors.onPrimary : theme.colors.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * First-run flow. The current step lives in prefs (not component state), so a relaunch resumes
 * it; the layout is one centered max-width column at every width, so rotation/unfold only
 * re-renders and never remounts (selection and search text survive).
 */
export function OnboardingFlow() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const prefs = usePrefs();
  const step = usePref("onboardingStep");
  const savedLanguage = usePref("language");
  const savedCurrency = usePref("homeCurrency");
  const lockEnabled = usePref("lockEnabled");

  const device = getLocales();
  const language = savedLanguage ?? resolveLanguage(device);
  const currency = savedCurrency ?? resolveHomeCurrency(device);

  const advance = () => prefs.set("onboardingStep", nextStep(step));
  const finish = () => {
    advance();
    router.replace("/");
  };

  let title: string;
  let body: React.ReactNode;
  let footer: React.ReactNode;
  let fillBody = false;
  switch (step) {
    case "currency":
      title = t("onboarding.currencyTitle");
      fillBody = true;
      body = (
        <>
          <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{t("onboarding.currencyHint")}</Text>
          <CurrencyPicker lang={language} value={currency} onChange={(c) => prefs.set("homeCurrency", c)} />
        </>
      );
      footer = (
        <Button
          label={t("common.next")}
          onPress={() => {
            // Persist the (possibly preselected) choice and the silent regional tax-year default.
            prefs.set("homeCurrency", currency);
            prefs.set("taxYearStartMonth", defaultTaxYearStartMonth(device[0]?.regionCode ?? null));
            advance();
          }}
        />
      );
      break;
    case "lock":
    case "done": // transient while router.replace runs
      title = t("onboarding.lockTitle");
      body = (
        <>
          <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{t("onboarding.lockHint")}</Text>
          <LockToggle label={t("onboarding.lockEnable")} value={lockEnabled} onChange={(v) => prefs.set("lockEnabled", v)} />
        </>
      );
      footer = (
        <Button
          label={lockEnabled ? t("onboarding.getStarted") : t("onboarding.lockSkip")}
          primary={lockEnabled}
          onPress={finish}
        />
      );
      break;
    default:
      title = t("onboarding.languageTitle");
      body = <LanguagePicker value={language} onChange={(l) => prefs.set("language", l)} />;
      footer = (
        <Button
          label={t("common.next")}
          onPress={() => {
            prefs.set("language", language);
            advance();
          }}
        />
      );
  }

  const column = { width: "100%", maxWidth: 560, alignSelf: "center", gap: theme.spacing.lg } as const;
  const head = (
    <>
      {step === "language" ? (
        <Text style={[theme.type.body, { color: theme.colors.textMuted }]}>{t("onboarding.welcome")}</Text>
      ) : null}
      <Text accessibilityRole="header" style={[theme.type.headline, { color: theme.colors.text }]}>
        {title}
      </Text>
    </>
  );
  const pad = { padding: theme.spacing.xl, paddingBottom: insets.bottom + theme.spacing.xl };

  // Same element types per step regardless of width, so a size change never remounts the picker.
  return fillBody ? (
    <StatusBarInset>
      <View style={[{ flex: 1, backgroundColor: theme.colors.background }, pad]}>
        <View style={[column, { flex: 1 }]}>
          {head}
          <View style={{ flex: 1, gap: theme.spacing.md }}>{body}</View>
          {footer}
        </View>
      </View>
    </StatusBarInset>
  ) : (
    <StatusBarInset>
      <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={pad}>
        <View style={column}>
          {head}
          {body}
          {footer}
        </View>
      </ScrollView>
    </StatusBarInset>
  );
}
