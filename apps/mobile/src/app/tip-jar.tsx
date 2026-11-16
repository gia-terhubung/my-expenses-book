import { Stack } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { createExpoIapTipJar } from "@/payments/expoIap";
import { TipJarScreen } from "@/tips/TipJarScreen";

export default function TipJarRoute() {
  const { t } = useTranslation();
  const [jar] = useState(createExpoIapTipJar);
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t("tips.title") }} />
      <TipJarScreen jar={jar} />
    </>
  );
}
