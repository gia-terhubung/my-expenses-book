import { router, useLocalSearchParams, type Href } from "expo-router";

import { ReceiptDetail } from "@/receipts/ReceiptDetail";

/** Compact receipt detail; the native stack header is the only back control here. */
export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ReceiptDetail
      id={id}
      onEdit={(rid) => router.push({ pathname: "/edit/[id]", params: { id: rid } } as unknown as Href)}
      onDeleted={() => router.back()}
    />
  );
}
