import { router, Stack, useLocalSearchParams, type Href } from "expo-router";
import { useTranslation } from "react-i18next";

import { ReceiptDetail } from "@/receipts/ReceiptDetail";

/** Compact receipt detail; the native stack header is the only back control here. */
export default function DocumentScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
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
