import {
  ErrorCode,
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  getPendingTransactionsIOS,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
} from "expo-iap";

import { Platform } from "react-native";

import { mapPurchaseError, recoverPurchases, settlePurchase, USER_CANCELLED } from "./tipFlow";
import { isTipId, TIP_IDS, type TipEvent, type TipJar, type TipProduct } from "./types";

// Compile-time guard: tipFlow.ts keeps the cancel code as a literal.
const cancelCode: `${ErrorCode.UserCancelled}` = USER_CANCELLED;
void cancelCode;

const finishFor = (purchase: Purchase) => (isConsumable: true) =>
  finishTransaction({ purchase, isConsumable }).then(() => undefined);

/**
 * The only file that imports expo-iap. No module-level side effects: nothing talks to a store
 * until the Tip jar screen calls `connect()`.
 */
export function createExpoIapTipJar(): TipJar {
  const listeners = new Set<(e: TipEvent) => void>();
  const emit = (e: TipEvent) => listeners.forEach((l) => l(e));

  return {
    async connect() {
      await initConnection();
      // Purchases completed while the screen was closed (deferred payment, app killed before
      // finish, iOS launch-time delivery) are only found by asking; the listener never replays them.
      const held = (await getAvailablePurchases().catch(() => [])) ?? [];
      const iosPending =
        Platform.OS === "ios" ? ((await getPendingTransactionsIOS().catch(() => [])) ?? []) : [];
      const seen = new Set<string>();
      const all = ([...held, ...iosPending] as Purchase[]).filter((p) => {
        const key = p.id ?? `${p.productId}:${p.transactionDate}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      await recoverPurchases(all, finishFor, emit);
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
      listeners.add(cb);
      const ok = purchaseUpdatedListener((purchase) => {
        void settlePurchase(purchase, finishFor(purchase)).then((e) => e && cb(e));
      });
      const err = purchaseErrorListener((e) => cb(mapPurchaseError(e)));
      return () => {
        listeners.delete(cb);
        ok.remove();
        err.remove();
      };
    },
    async disconnect() {
      await endConnection();
    },
  };
}
