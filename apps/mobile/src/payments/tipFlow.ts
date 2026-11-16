import { isTipId, type TipEvent } from "./types";

/** expo-iap `ErrorCode.UserCancelled`; kept as a literal so this file stays store-free. */
export const USER_CANCELLED = "user-cancelled";

/**
 * Every purchase is finished as a consumable, known or not: an unfinished one is refunded by
 * Google after 3 days and replayed by iOS on every launch. Thanks only after finish succeeds.
 */
export async function handlePurchase(
  p: { productId: string },
  finish: (consumable: true) => Promise<void>,
): Promise<TipEvent | null> {
  await finish(true);
  return isTipId(p.productId) ? { kind: "thanks", id: p.productId } : null;
}

export function mapPurchaseError(e: { code?: string }): TipEvent {
  if (e.code === USER_CANCELLED) return { kind: "cancelled" };
  return { kind: "failed", code: e.code || "unknown" };
}
