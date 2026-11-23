import { getLocales } from "expo-localization";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";

import { deviceTimeZone, formatLocal } from "@/capture/localTime";
import { Button } from "@/components/Button";
import { CurrencyPicker } from "@/components/CurrencyPicker";
import { LanguagePicker } from "@/components/LanguagePicker";
import { LockToggle } from "@/components/LockToggle";
import { TaxYearPicker } from "@/components/TaxYearPicker";
import { now } from "@/dates/clock";
import { defaultTaxYearStartMonth, resolveHomeCurrency, resolveLanguage } from "@/i18n/resolve";
import { StatusBarInset } from "@/layout/StatusBarInset";
import { useSideInsets } from "@/layout/SideSafeArea";
import { formatMoney } from "@/money/money";
import { nextStep, prevStep, SETUP_STEPS } from "@/onboarding/steps";
import type { OnboardingStep } from "@/prefs/prefs";
import { usePref, usePrefs } from "@/prefs/PrefsProvider";
import { MonthStartPicker } from "@/settings/MonthStartPicker";
import { useTheme } from "@/theme/ThemeProvider";

import { ExampleCard } from "./ExampleCard";
import { currencyExampleHome, payCycleExample, taxYearExample } from "./examples";
import { guideMode } from "./guideLayout";
import { GuideShell } from "./GuideShell";
import { InfoText } from "./InfoText";
import { TourCards } from "./TourCards";

type Props = { mode: "firstRun" | "replay"; onClose?: () => void };

/**
 * The guide: five explained setup steps, then the how-it-works cards. First run keeps the step in
 * prefs (a relaunch resumes it) and finishes to Home; replay keeps it in state, never touches
 * `onboardingStep`, and can be closed at any step. Choices save as they are made, like Settings.
 */
export function GuideFlow({ mode, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, type } = useTheme();
  const prefs = usePrefs();
  const { width, height } = useWindowDimensions();
  const side = useSideInsets();
  const layout = guideMode({ width, height, left: side.left, right: side.right });
  const replay = mode === "replay";

  const persisted = usePref("onboardingStep");
  const [local, setLocal] = useState<OnboardingStep>("language");
  const step = replay ? local : persisted;
  const go = (s: OnboardingStep) => (replay ? setLocal(s) : prefs.set("onboardingStep", s));

  const savedLanguage = usePref("language");
  const savedCurrency = usePref("homeCurrency");
  const savedTaxYear = usePref("taxYearStartMonth");
  const payDay = usePref("monthStartDay") ?? 1;
  const lockEnabled = usePref("lockEnabled");

  const device = getLocales();
  const language = savedLanguage ?? resolveLanguage(device);
  const currency = savedCurrency ?? resolveHomeCurrency(device);
  const regionalTaxYear = defaultTaxYearStartMonth(device[0]?.regionCode ?? null);
  // First arrival on the tax-year step in a first run preselects the regional default; once the
  // step was confirmed (or reached by Back, or in a replay) the saved value is shown.
  const [taxFromSaved, setTaxFromSaved] = useState(replay);
  const [taxPick, setTaxPick] = useState<number | null>(null);
  const taxYear = taxPick ?? (taxFromSaved ? savedTaxYear : regionalTaxYear);

  const locale = i18n.language || "en";
  const today = formatLocal(now(), deviceTimeZone()).slice(0, 10);
  const muted = [type.body, { color: colors.textMuted }];

  const finish = () => {
    prefs.set("guideSeen", true);
    if (replay) {
      onClose?.();
      return;
    }
    prefs.set("onboardingStep", "done");
    router.replace("/");
  };
  const back = () => {
    const to = prevStep(step);
    if (to === "taxYear") {
      setTaxFromSaved(true);
      setTaxPick(null);
    }
    go(to);
  };

  const footer = (onNext: () => void, nextLabel = t("common.next"), primary = true): ReactNode => (
    <View style={{ flexDirection: "row", justifyContent: step === "language" ? "flex-end" : "space-between", gap: 12 }}>
      {step !== "language" ? <Button variant="quiet" label={t("common.back")} onPress={back} /> : null}
      <Button variant={primary ? "primary" : "quiet"} align="center" label={nextLabel} onPress={onNext} />
    </View>
  );

  if (step === "tour" || step === "done") {
    return (
      <StatusBarInset>
        <TourCards mode={layout} onBackFromFirst={() => go("lock")} onDone={finish} onClose={replay ? onClose : undefined} />
      </StatusBarInset>
    );
  }

  const index = SETUP_STEPS.indexOf(step as (typeof SETUP_STEPS)[number]);
  const dots = { n: index + 1, total: SETUP_STEPS.length };
  let title: string;
  let explain: ReactNode;
  let control: ReactNode = null;
  let controlScrolls = false;
  let controlFixed = false;
  let foot: ReactNode;

  switch (step) {
    case "currency": {
      const home = currencyExampleHome(currency, locale);
      title = t("onboarding.currencyTitle");
      explain = (
        <>
          <Text style={muted}>{t("info.homeCurrency.summary")}</Text>
          {home ? (
            <ExampleCard
              testID="guide-currency-example"
              value={t("guide.currencyExample", { foreign: formatMoney(1200, "EUR", locale), home })}
            />
          ) : null}
        </>
      );
      control = <CurrencyPicker lang={language} value={currency} onChange={(c) => prefs.set("homeCurrency", c)} />;
      controlScrolls = true;
      foot = footer(() => {
        // First run confirms the preselection; a replay only saves what the user picks.
        if (!replay) prefs.set("homeCurrency", currency);
        go(nextStep(step));
      });
      break;
    }
    case "taxYear": {
      const ex = taxYearExample(today, taxYear, locale);
      title = t("guide.taxYearTitle");
      explain = (
        <>
          <Text style={muted}>{t("info.taxYear.summary")}</Text>
          <ExampleCard testID="guide-tax-example" label={t("guide.taxYearExample", { label: ex.label })} value={ex.range} />
          <Text style={muted}>{t("info.taxYear.body")}</Text>
        </>
      );
      control = (
        <TaxYearPicker
          lang={language}
          value={taxYear}
          onChange={(m) => {
            setTaxPick(m);
            if (replay) prefs.set("taxYearStartMonth", m);
          }}
        />
      );
      foot = footer(() => {
        prefs.set("taxYearStartMonth", taxYear);
        setTaxFromSaved(true);
        setTaxPick(null);
        go(nextStep(step));
      });
      break;
    }
    case "payCycle":
      title = t("guide.payCycleTitle");
      explain = (
        <>
          <Text style={muted}>{t("info.payCycle.summary")}</Text>
          <InfoText topic="payCycle" />
        </>
      );
      // The example sits right above the grid: tap a day, see the range change next to it.
      control = (
        <View style={{ gap: 12 }}>
          <ExampleCard testID="guide-pay-example" label={t("guide.thisMonth")} value={payCycleExample(today, payDay, locale)} />
          <MonthStartPicker value={payDay} onChange={(d) => prefs.set("monthStartDay", d)} />
        </View>
      );
      controlFixed = true;
      foot = footer(() => {
        prefs.set("monthStartDay", payDay);
        go(nextStep(step));
      });
      break;
    case "lock":
      title = t("onboarding.lockTitle");
      explain = <Text style={muted}>{t("onboarding.lockHint")}</Text>;
      control = <LockToggle label={t("onboarding.lockEnable")} value={lockEnabled} onChange={(v) => prefs.set("lockEnabled", v)} />;
      controlFixed = true;
      foot = footer(() => go(nextStep(step)), lockEnabled ? t("common.next") : t("onboarding.lockSkip"), lockEnabled);
      break;
    default:
      title = t("onboarding.languageTitle");
      explain = <Text style={muted}>{t("onboarding.welcome")}</Text>;
      control = <LanguagePicker value={language} onChange={(l) => prefs.set("language", l)} />;
      controlFixed = true;
      foot = footer(() => {
        if (!replay) prefs.set("language", language);
        go(nextStep(step));
      });
  }

  return (
    <StatusBarInset>
      <GuideShell
        mode={layout}
        dots={dots}
        title={title}
        explain={explain}
        control={control}
        controlScrolls={controlScrolls}
        controlFixed={controlFixed}
        footer={foot}
        onClose={replay ? onClose : undefined}
      />
    </StatusBarInset>
  );
}
