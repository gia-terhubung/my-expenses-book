import { useCallback, useEffect, useRef, useState } from "react";

import type { TipEvent, TipId, TipJar, TipProduct } from "@/payments/types";

export type TipJarState = "loading" | "ready" | "unavailable" | "buying";

/**
 * Store connection lives exactly as long as the screen (C1): connect on mount, disconnect on
 * unmount. The event listener is attached before connect so a replayed purchase is not missed.
 */
export function useTipJar(jar: TipJar) {
  const [state, setState] = useState<TipJarState>("loading");
  const [products, setProducts] = useState<TipProduct[]>([]);
  const [thanked, setThanked] = useState<TipId | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const off = jar.onEvent((e: TipEvent) => {
      if (!alive.current) return;
      if (e.kind === "thanks") {
        setThanked(e.id);
        setFailed(false);
      } else if (e.kind === "failed") {
        setFailed(true);
      }
      setState((s) => (s === "buying" ? "ready" : s));
    });
    return () => {
      alive.current = false;
      off();
      jar.disconnect().catch(() => {});
    };
  }, [jar]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await jar.connect();
        const list = await jar.products();
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
      setFailed(false);
      setState("buying");
      jar.buy(id).catch(() => {
        if (!alive.current) return;
        setFailed(true);
        setState("ready");
      });
    },
    [jar],
  );

  const retry = useCallback(() => {
    setState("loading");
    setAttempt((n) => n + 1);
  }, []);

  return { state, products, thanked, failed, buy, retry };
}
