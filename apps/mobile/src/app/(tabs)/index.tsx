import { useTranslation } from "react-i18next";

import { EmptyState } from "@/layout/EmptyState";

export default function ReceiptsScreen() {
  const { t } = useTranslation();
  return <EmptyState title={t("tabs.receipts")} message={t("empty.receipts")} />;
}
