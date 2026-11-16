import { isTipId, type TipEvent } from "./types";

/** expo-iap `ErrorCode.UserCancelled`; kept as a literal so this file stays store-free. */
export const USER_CANCELLED = "user-cancelled";

export type StorePurchase = { productId: string; purchaseState?: string };

/**
 * Every completed purchase is finished as a consumable, known or not: an unfinished one is
 * refunded by Google after 3 days and replayed by iOS. A pending purchase (deferred payment) is
 * left alone until the store reports it purchased. Thanks only after finish succeeds.
 */
export async function handlePurchase(
  p: StorePurchase,
  finish: (consumable: true) => Promise<void>,
): Promise<TipEvent | null> {
  if (p.purchaseState === "pending") return { kind: "pending" };
  await finish(true);
  return isTipId(p.productId) ? { kind: "thanks", id: p.productId } : null;
}

/** handlePurchase that never rejects: a finish failure after a real charge is not "failed". */
export async function settlePurchase(
  p: StorePurchase,
  finish: (consumable: true) => Promise<void>,
): Promise<TipEvent | null> {
  try {
    return await handlePurchase(p, finish);
  } catch {
    return { kind: "finishLater" };
  }
}

/** On connect: settle purchases the store still holds (missed while closed, killed mid-finish). */
export async function recoverPurchases<P extends StorePurchase>(
  purchases: P[],
  finishFor: (p: P) => (consumable: true) => Promise<void>,
  emit: (e: TipEvent) => void,
): Promise<void> {
  for (const p of purchases) {
    const e = await settlePurchase(p, finishFor(p));
    if (e) emit(e);
  }
}

export function mapPurchaseError(e: { code?: string }): TipEvent {
  if (e.code === USER_CANCELLED) return { kind: "cancelled" };
  return { kind: "failed", code: e.code || "unknown" };
}
