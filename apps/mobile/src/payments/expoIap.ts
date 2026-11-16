import {
  ErrorCode,
  endConnection,
  fetchProducts,
  finishTransaction,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from "expo-iap";

import { handlePurchase, mapPurchaseError, USER_CANCELLED } from "./tipFlow";
import { isTipId, TIP_IDS, type TipJar, type TipProduct } from "./types";

// Compile-time guard: tipFlow.ts keeps the cancel code as a literal.
const cancelCode: `${ErrorCode.UserCancelled}` = USER_CANCELLED;
void cancelCode;

/**
 * The only file that imports expo-iap. No module-level side effects: nothing talks to a store
 * until the Tip jar screen calls `connect()`.
 */
export function createExpoIapTipJar(): TipJar {
  return {
    async connect() {
      await initConnection();
    },
    async products() {
      const res = await fetchProducts({ skus: [...TIP_IDS], type: "in-app" });
      const out: TipProduct[] = [];
      for (const p of (res ?? []) as { id: string; displayPrice: string; title: string }[]) {
        if (isTipId(p.id)) out.push({ id: p.id, displayPrice: p.displayPrice, title: p.title });
      }
      return TIP_IDS.flatMap((id) => out.filter((p) => p.id === id));
    },
    async buy(id) {
      await requestPurchase({ request: { apple: { sku: id }, google: { skus: [id] } }, type: "in-app" });
    },
    onEvent(cb) {
      const ok = purchaseUpdatedListener((purchase) => {
        handlePurchase(purchase, (isConsumable) => finishTransaction({ purchase, isConsumable }).then(() => undefined))
          .then((e) => e && cb(e))
          .catch((err: unknown) => cb({ kind: "failed", code: String((err as { code?: string })?.code ?? "finish") }));
      });
      const err = purchaseErrorListener((e) => cb(mapPurchaseError(e)));
      return () => {
        ok.remove();
        err.remove();
      };
    },
    async disconnect() {
      await endConnection();
    },
  };
}
