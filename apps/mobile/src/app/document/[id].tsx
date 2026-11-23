import { router, useLocalSearchParams, type Href } from "expo-router";

import { StatusBarInset } from "@/layout/StatusBarInset";
import { useLayout } from "@/layout/useLayout";
import { usePopToSelection } from "@/receipts/pendingSelection";
import { ReceiptDetail } from "@/receipts/ReceiptDetail";

/**
 * Receipt detail when not split; its ScreenHeader chevron is the back control, like every page.
 * After an unfold it hands the receipt to the list's selection and pops.
 */
export default function DocumentScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  usePopToSelection(id, useLayout().split, from === "list");
  return (
    <StatusBarInset>
      <ReceiptDetail
        id={id}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        onEdit={(rid) => router.push({ pathname: "/edit/[id]", params: { id: rid } } as unknown as Href)}
        onDeleted={() => router.back()}
      />
    </StatusBarInset>
  );
}
