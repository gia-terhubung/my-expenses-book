import { router, useLocalSearchParams, type Href } from "expo-router";

import { ReceiptDetail } from "@/receipts/ReceiptDetail";

export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ReceiptDetail
      id={id}
      onEdit={(rid) => router.push({ pathname: "/edit/[id]", params: { id: rid } } as unknown as Href)}
      onDeleted={() => router.back()}
      onBack={() => router.back()}
    />
  );
}
