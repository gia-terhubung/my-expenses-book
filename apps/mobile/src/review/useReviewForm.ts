import { router, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { findDuplicates, type DuplicateMatch } from "@/capture/duplicates";
import { useDb } from "@/db/DatabaseProvider";
import { countPagesByImagePath, listPages, softDeletePages } from "@/db/repositories/pages";
import { getReceipt, softDeleteReceipt, updateReceipt } from "@/db/repositories/receipts";
import type { AppDb, Receipt, ReceiptPage } from "@/db/types";
import { ensureRates } from "@/fx/rates";
import { useImageStore } from "@/images/ImageStoreProvider";
import type { FieldConfidence } from "@/parsing/types";
import { usePref, usePrefs } from "@/prefs/PrefsProvider";
import type { FxCache } from "@/prefs/prefs";

import {
  CONFIDENCE_OF,
  draftPatch,
  isKnownCurrency,
  isValidDate,
  LOW_CONFIDENCE,
  parseConfidence,
  previewFx,
  validate,
  valuesFromReceipt,
  type FxPreview,
  type ReviewErrors,
  type ReviewField,
  type ReviewValues,
} from "./form";

export const WRITE_DEBOUNCE_MS = 300;

export class ReviewValidationError extends Error {
  constructor(readonly errors: ReviewErrors) {
    super("Review form is invalid");
    this.name = "ReviewValidationError";
  }
}

export type ReviewForm = {
  /** The draft as loaded; "missing" when it is gone (discarded / saved elsewhere). */
  receipt: Receipt | "missing";
  pages: ReceiptPage[];
  values: ReviewValues;
  setField<K extends ReviewField>(name: K, value: ReviewValues[K]): void;
  lowConfidence: Set<keyof FieldConfidence>;
  duplicates: DuplicateMatch[];
  errors: ReviewErrors;
  home: string;
  fx: FxPreview;
  busy: boolean;
  save(): Promise<void>;
  discard(): Promise<void>;
};

const EMPTY: ReviewValues = {
  merchant: "",
  date: "",
  time: "",
  total: "",
  currency: "",
  tax: "",
  categoryId: null,
  notes: "",
  fxRate: "",
};

const NO_PAGES: ReceiptPage[] = [];

/** The draft and its pages; "missing" when it was deleted or is no longer a draft. */
function loadDraft(db: AppDb, id: string): { receipt: Receipt; pages: ReceiptPage[] } | "missing" {
  const receipt = getReceipt(db, id);
  if (!receipt || receipt.status !== "draft") return "missing";
  return { receipt, pages: listPages(db, id) };
}

function pageHashes(pages: ReceiptPage[]): string[] {
  return pages.flatMap((p) => (p.dhash ? [p.dhash] : []));
}

/** Opens the next queued draft, or closes the review flow. */
export function goNext(queue: string[]): void {
  const [next, ...rest] = queue;
  if (next) {
    router.replace({ pathname: "/review/[id]", params: { id: next, queue: rest.join(",") } } as unknown as Href);
  } else {
    router.back();
  }
}

/** Soft-deletes a receipt and its page rows, then deletes page files no other live receipt uses. */
export async function discardReceipt(
  db: AppDb,
  images: { deleteFiles(paths: string[]): Promise<void> },
  id: string,
): Promise<void> {
  const pages = listPages(db, id);
  db.transaction((tx) => {
    softDeleteReceipt(tx as unknown as AppDb, id);
    softDeletePages(tx as unknown as AppDb, id);
  });
  const paths = new Set<string>();
  for (const p of pages) {
    if (countPagesByImagePath(db, p.imagePath, id) > 0) continue; // split sibling keeps the photo
    paths.add(p.imagePath);
    if (p.thumbPath) paths.add(p.thumbPath);
  }
  // A failure leaves orphans that the launch sweep (cleanupOrphanPages) removes.
  if (paths.size) await images.deleteFiles([...paths]);
}

/**
 * State and actions of the draft review screen. Every edit is written through to the draft row
 * 300 ms after the last keystroke, and immediately when the app goes to the background or the
 * screen unmounts (fold/unfold, close), so nothing typed is lost. `save` validates, refreshes FX
 * rates for the purchase date (best effort), recomputes the home amount, confirms the receipt
 * and opens the next queued draft (or closes); `discard` deletes the draft and unshared photos.
 */
export function useReviewForm(id: string, opts: { queue?: string[] } = {}): ReviewForm {
  const db = useDb();
  const images = useImageStore();
  const prefs = usePrefs();
  const home = usePref("homeCurrency") ?? "USD";
  const queueRef = useRef(opts.queue ?? []);

  // The DB is synchronous, so the draft is read once while the screen mounts. A new id comes
  // with a new screen (router.replace), never with new props on this one.
  const [loaded] = useState(() => loadDraft(db, id));
  const receipt = loaded === "missing" ? "missing" : loaded.receipt;
  const pages = loaded === "missing" ? NO_PAGES : loaded.pages;
  const [confidence] = useState(() => (loaded === "missing" ? null : parseConfidence(loaded.receipt.parseConfidence)));
  const [values, setValues] = useState<ReviewValues>(() => (loaded === "missing" ? EMPTY : valuesFromReceipt(loaded.receipt)));
  const [edited, setEdited] = useState<Set<keyof FieldConfidence>>(() => new Set());
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>(() =>
    loaded === "missing" ? [] : findDuplicates(db, loaded.receipt, pageHashes(loaded.pages)),
  );
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [fxCache, setFxCache] = useState<FxCache>(() => prefs.get("fxTables"));
  const [busy, setBusy] = useState(false);

  // Latest state for timers / AppState / unmount callbacks.
  const valuesRef = useRef(values);
  const receiptRef = useRef<Receipt | null>(loaded === "missing" ? null : loaded.receipt);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const homeRef = useRef(home);
  useEffect(() => {
    homeRef.current = home;
    queueRef.current = opts.queue ?? [];
  });

  const refreshDuplicates = useCallback(
    (r: Receipt) => setDuplicates(findDuplicates(db, r, pageHashes(listPages(db, r.id)))),
    [db],
  );

  /** Writes pending edits now. Sync (SQLite), so it is safe in unmount / background handlers. */
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const r = receiptRef.current;
    if (!dirty.current || !r) return;
    dirty.current = false;
    try {
      receiptRef.current = updateReceipt(db, r.id, draftPatch(r, valuesRef.current, homeRef.current, prefs.get("fxTables")));
    } catch (e) {
      if (__DEV__) console.warn("review write-through failed", e);
    }
  }, [db, prefs]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") flush();
    });
    return () => {
      sub.remove();
      flush();
    };
  }, [flush]);

  const setField = useCallback(
    <K extends ReviewField>(name: K, value: ReviewValues[K]) => {
      valuesRef.current = { ...valuesRef.current, [name]: value };
      setValues(valuesRef.current);
      const c = CONFIDENCE_OF[name];
      if (c) setEdited((prev) => (prev.has(c) ? prev : new Set(prev).add(c)));
      setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
      dirty.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        flush();
        if (receiptRef.current) refreshDuplicates(receiptRef.current);
      }, WRITE_DEBOUNCE_MS);
    },
    [flush, refreshDuplicates],
  );

  // Foreign currency: fetch the purchase-date table in the background for the ≈ preview.
  const foreignDate =
    isKnownCurrency(values.currency) && values.currency.toUpperCase() !== home.toUpperCase() && isValidDate(values.date)
      ? values.date
      : null;
  useEffect(() => {
    if (!foreignDate) return;
    let cancelled = false;
    const before = prefs.get("fxTables");
    ensureRates(before, home, foreignDate, Date.now()).then(
      (next) => {
        if (next === before) return;
        prefs.set("fxTables", next);
        if (!cancelled) setFxCache(next);
      },
      () => undefined, // best effort: offline keeps the preview empty
    );
    return () => {
      cancelled = true;
    };
  }, [foreignDate, home, prefs]);

  const lowConfidence = useMemo(() => {
    const out = new Set<keyof FieldConfidence>();
    if (!confidence) return out;
    for (const k of Object.keys(confidence) as (keyof FieldConfidence)[]) {
      if (typeof confidence[k] === "number" && confidence[k] < LOW_CONFIDENCE && !edited.has(k)) out.add(k);
    }
    return out;
  }, [confidence, edited]);

  const fx = useMemo(() => previewFx(values, home, fxCache), [values, home, fxCache]);

  const save = useCallback(async () => {
    const r = receiptRef.current;
    if (!r) return;
    flush();
    const v = valuesRef.current;
    const errs = validate(v);
    setErrors(errs);
    if (Object.keys(errs).length) throw new ReviewValidationError(errs);
    setBusy(true);
    try {
      let cache = prefs.get("fxTables");
      if (v.currency.toUpperCase() !== home.toUpperCase() && !v.fxRate.trim()) {
        try {
          const next = await ensureRates(cache, home, v.date, Date.now());
          if (next !== cache) {
            prefs.set("fxTables", next);
            cache = next;
          }
        } catch {
          // best effort: offline saves with amountHomeMinor null (filled in by a later FX sync)
        }
      }
      updateReceipt(db, r.id, { ...draftPatch(r, v, home, cache), status: "confirmed" });
      receiptRef.current = null; // confirmed: no draft write-through after this point
    } finally {
      setBusy(false);
    }
    goNext(queueRef.current);
  }, [db, flush, home, prefs]);

  const discard = useCallback(async () => {
    const r = receiptRef.current;
    if (!r) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    dirty.current = false;
    receiptRef.current = null;
    setBusy(true);
    try {
      await discardReceipt(db, images, r.id);
    } finally {
      setBusy(false);
    }
    goNext(queueRef.current);
  }, [db, images]);

  return { receipt, pages, values, setField, lowConfidence, duplicates, errors, home, fx, busy, save, discard };
}
