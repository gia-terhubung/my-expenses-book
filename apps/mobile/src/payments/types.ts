/** Spec "Monetization v1": three consumable tips, in display order. */
export const TIP_IDS = ["tip_coffee_small", "tip_coffee_standard", "tip_coffee_generous"] as const;
export type TipId = (typeof TIP_IDS)[number];

/** Price text comes from the store (localized `displayPrice`); never hardcoded. */
export type TipProduct = { id: TipId; displayPrice: string; title: string };

export type TipEvent = { kind: "thanks"; id: TipId } | { kind: "cancelled" } | { kind: "failed"; code: string };

/**
 * Purchase surface used by the app. Only `expoIap.ts` talks to the store, so a later swap to
 * RevenueCat (Pro launch) stays inside `src/payments/`.
 */
export interface TipJar {
  connect(): Promise<void>;
  products(): Promise<TipProduct[]>;
  buy(id: TipId): Promise<void>;
  /** Purchase results arrive here (also replayed, unfinished purchases). Returns unsubscribe. */
  onEvent(cb: (e: TipEvent) => void): () => void;
  disconnect(): Promise<void>;
}

export function isTipId(id: string): id is TipId {
  return (TIP_IDS as readonly string[]).includes(id);
}
