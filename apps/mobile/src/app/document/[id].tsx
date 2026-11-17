import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { useTranslation } from "react-i18next";

import { useLayout } from "@/layout/useLayout";
import { usePopToSelection } from "@/receipts/pendingSelection";
import { ReceiptDetail } from "@/receipts/ReceiptDetail";

/**
 * Receipt detail when not split; the native stack header is the only back control here. After an
 * unfold it hands the receipt to the list's selection and pops.
 */
export default function DocumentScreen() {
  const { t } = useTranslation();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  usePopToSelection(id, useLayout().split, from === "list");
  return (
    <>
      <Stack.Screen options={{ title: t("document.title") }} />
      <ReceiptDetail
        id={id}
        underHeader
        onEdit={(rid) => router.push({ pathname: "/edit/[id]", params: { id: rid } } as unknown as Href)}
        onDeleted={() => router.back()}
      />
    </>
  );
}
