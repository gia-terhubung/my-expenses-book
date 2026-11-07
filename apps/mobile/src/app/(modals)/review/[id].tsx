import { ReceiptFormScreen } from "@/review/ReceiptFormScreen";

/** Draft review: confirm a captured or manual draft (params: id, queue, failed, total). */
export default function ReviewScreen() {
  return <ReceiptFormScreen mode="review" />;
}
