import { TIP_IDS, type TipEvent, type TipId, type TipJar, type TipProduct } from "./types";

const DEFAULT_PRODUCTS: TipProduct[] = TIP_IDS.map((id, i) => ({
  id,
  displayPrice: ["$2.99", "$4.99", "$9.99"][i],
  title: id,
}));

/** In-memory TipJar for tests and dev screens; `emit` plays a store event. */
export function createFakeTipJar(
  opts: { products?: TipProduct[]; failConnect?: boolean; hangConnect?: boolean; buyRejects?: { code: string } } = {},
) {
  const listeners = new Set<(e: TipEvent) => void>();
  const jar: TipJar & { emit(e: TipEvent): void; bought: TipId[]; connects: number; disconnects: number } = {
    bought: [],
    connects: 0,
    disconnects: 0,
    async connect() {
      jar.connects += 1;
      if (opts.hangConnect) return new Promise<void>(() => {});
      if (opts.failConnect) throw new Error("store unavailable");
    },
    async products() {
      return opts.products ?? DEFAULT_PRODUCTS;
    },
    async buy(id) {
      jar.bought.push(id);
      // Like expo-iap: every purchase error (cancel included) also rejects requestPurchase.
      if (opts.buyRejects) throw Object.assign(new Error(opts.buyRejects.code), opts.buyRejects);
    },
    onEvent(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async disconnect() {
      jar.disconnects += 1;
    },
    emit(e) {
      listeners.forEach((l) => l(e));
    },
  };
  return jar;
}
