import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/layout/EmptyState";

export default function DocumentScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EmptyState title={`${t("document.title")} ${id}`} message={t("empty.document")} />;
}
