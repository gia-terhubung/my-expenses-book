import { useTranslation } from "react-i18next";

import { EmptyState } from "@/layout/EmptyState";

export default function SearchScreen() {
  const { t } = useTranslation();
  return <EmptyState title={t("tabs.search")} message={t("empty.search")} />;
}
