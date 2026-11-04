import { useTranslation } from "react-i18next";

import { EmptyState } from "@/layout/EmptyState";

export default function FoldersScreen() {
  const { t } = useTranslation();
  return <EmptyState title={t("tabs.folders")} message={t("empty.folders")} />;
}
