import { TIP_IDS, type TipEvent, type TipId, type TipJar, type TipProduct } from "./types";

const DEFAULT_PRODUCTS: TipProduct[] = TIP_IDS.map((id, i) => ({
  id,
  displayPrice: ["$2.99", "$4.99", "$9.99"][i],
  title: id,
}));

/** In-memory TipJar for tests and dev screens; `emit` plays a store event. */
export function createFakeTipJar(opts: { products?: TipProduct[]; failConnect?: boolean } = {}) {
  const listeners = new Set<(e: TipEvent) => void>();
  const jar: TipJar & { emit(e: TipEvent): void; bought: TipId[]; connects: number; disconnects: number } = {
    bought: [],
    connects: 0,
    disconnects: 0,
    async connect() {
      jar.connects += 1;
      if (opts.failConnect) throw new Error("store unavailable");
    },
    async products() {
      return opts.products ?? DEFAULT_PRODUCTS;
    },
    async buy(id) {
      jar.bought.push(id);
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
