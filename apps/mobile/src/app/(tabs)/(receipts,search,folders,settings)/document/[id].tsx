import { router, useLocalSearchParams, type Href } from "expo-router";
import { Platform } from "react-native";

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
  // SPIKE (iOS): native header, so Back, Edit and ⋯ move into the iPhone Duo side column.
  const nativeHeader = Platform.OS === "ios";
  const detail = (
    <ReceiptDetail
      nativeHeader={nativeHeader}
      id={id}
      onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      onEdit={(rid) =>
        router.push({
          pathname: "/edit/[id]",
          params: { id: rid },
        } as unknown as Href)
      }
      onDeleted={() => router.back()}
    />
  );
  return nativeHeader ? detail : <StatusBarInset>{detail}</StatusBarInset>;
}
