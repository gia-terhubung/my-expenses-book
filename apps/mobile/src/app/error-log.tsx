import Constants from "expo-constants";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { ErrorLogScreen } from "@/errorLog/ErrorLogScreen";

export default function ErrorLogRoute() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t("errorLog.title") }} />
      <ErrorLogScreen appVersion={Constants.expoConfig?.version ?? "?"} />
    </>
  );
}
