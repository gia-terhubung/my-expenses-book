import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

import { BackupScreen } from "@/backup/BackupScreen";

export default function BackupRoute() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t("backup.title") }} />
      <BackupScreen />
    </>
  );
}
