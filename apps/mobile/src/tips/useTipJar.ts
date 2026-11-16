import { useCallback, useEffect, useRef, useState } from "react";

import { mapPurchaseError } from "@/payments/tipFlow";
import type { TipEvent, TipId, TipJar, TipProduct } from "@/payments/types";

export type TipJarState = "loading" | "ready" | "unavailable" | "buying";
export type TipNotice = "failed" | "pending" | "finishLater" | null;

/** A store that never answers (billing service stuck, Play Services updating) must not spin forever. */
export const CONNECT_TIMEOUT_MS = 15_000;
/** requestPurchase can resolve with no event (iOS Ask to Buy / deferred): re-enable the tiers. */
export const BUY_SETTLE_MS = 3_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * Store connection lives exactly as long as the screen (C1): connect on mount, disconnect on
 * unmount. The event listener is attached before connect so recovered and replayed purchases
 * are not missed.
 */
export function useTipJar(jar: TipJar) {
  const [state, setState] = useState<TipJarState>("loading");
  const [products, setProducts] = useState<TipProduct[]>([]);
  const [thanked, setThanked] = useState<TipId | null>(null);
  const [notice, setNotice] = useState<TipNotice>(null);
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const backToReady = () => setState((s) => (s === "buying" ? "ready" : s));

  useEffect(() => {
    alive.current = true;
    const off = jar.onEvent((e: TipEvent) => {
      if (!alive.current) return;
      if (e.kind === "thanks") {
        setThanked(e.id);
        setNotice(null);
      } else if (e.kind === "failed" || e.kind === "pending" || e.kind === "finishLater") {
        setNotice(e.kind);
      }
      backToReady();
    });
    return () => {
      alive.current = false;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      off();
      jar.disconnect().catch(() => {});
    };
  }, [jar]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await withTimeout(
          jar.connect().then(() => jar.products()),
          CONNECT_TIMEOUT_MS,
        );
        if (cancelled) return;
        setProducts(list);
        setState(list.length ? "ready" : "unavailable");
      } catch {
        if (!cancelled) setState("unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jar, attempt]);

  const buy = useCallback(
    (id: TipId) => {
      setNotice(null);
      setState("buying");
      jar.buy(id).then(
        () => {
          if (settleTimer.current) clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(() => alive.current && backToReady(), BUY_SETTLE_MS);
        },
        (e: unknown) => {
          if (!alive.current) return;
          // expo-iap rejects requestPurchase on every purchase error, a user cancel included.
          if (mapPurchaseError((e ?? {}) as { code?: string }).kind === "failed") setNotice("failed");
          backToReady();
        },
      );
    },
    [jar],
  );

  const retry = useCallback(() => {
    setState("loading");
    setAttempt((n) => n + 1);
  }, []);

  return { state, products, thanked, notice, buy, retry };
}
