import { router, usePreventRemove, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { useTranslation } from "react-i18next";

import { findDuplicates, type DuplicateMatch } from "@/capture/duplicates";
import { useDb } from "@/db/DatabaseProvider";
import { countPagesByImagePath, listPages, softDeletePages } from "@/db/repositories/pages";
import { getReceipt, softDeleteReceipt, updateReceipt } from "@/db/repositories/receipts";
import type { AppDb, Receipt, ReceiptPage } from "@/db/types";
import { mergeFxCache } from "@/fx/mergeCache";
import { ensureRates } from "@/fx/rates";
import { useImageStore } from "@/images/ImageStoreProvider";
import type { ImageStore } from "@/images/store";
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

/** `review`: confirm a draft (write-through as you type). `edit`: change a confirmed receipt (writes on Save only). */
export type ReviewFormMode = "review" | "edit";

export type ReviewForm = {
  mode: ReviewFormMode;
  /**
   * The receipt as loaded; "missing" when it is gone (discarded / saved elsewhere) or not in the
   * state the mode expects (review: a draft; edit: a confirmed receipt).
   */
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
  /** Review mode: deletes the draft and unshared photos. No-op in edit mode. */
  discard(): Promise<void>;
  /** Edit mode: leaves without saving, straight back when nothing changed, else after "Discard changes?". Review mode: goes back. */
  cancel(): void;
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
  folderId: null,
};

const NO_PAGES: ReceiptPage[] = [];

/** Form fields the home amount is computed from. */
const FX_DRIVERS: readonly ReviewField[] = ["currency", "total", "date", "fxRate"];

/** The receipt and its pages; "missing" when it was deleted or is not in the mode's status. */
function loadReceipt(db: AppDb, id: string, mode: ReviewFormMode): { receipt: Receipt; pages: ReceiptPage[] } | "missing" {
  const receipt = getReceipt(db, id);
  if (!receipt || receipt.status !== (mode === "edit" ? "confirmed" : "draft")) return "missing";
  return { receipt, pages: listPages(db, id) };
}

function pageHashes(pages: ReceiptPage[]): string[] {
  return pages.flatMap((p) => (p.dhash ? [p.dhash] : []));
}

function hasChanges(v: ReviewValues, initial: ReviewValues): boolean {
  return (Object.keys(initial) as ReviewField[]).some((k) => v[k] !== initial[k]);
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

/**
 * Soft-deletes a receipt and its page rows, deletes the decrypted view copies of its pages, then
 * deletes page files no other live receipt uses. File errors are swallowed (logged in dev): the
 * rows are already gone, and the launch sweeps remove what is left.
 */
export async function discardReceipt(
  db: AppDb,
  images: Pick<ImageStore, "deleteFiles" | "closeViews">,
  id: string,
): Promise<void> {
  const pages = listPages(db, id);
  // Plaintext first: the view copies would otherwise wait for the next background purge.
  const viewed = pages.flatMap((p) => (p.thumbPath ? [p.imagePath, p.thumbPath] : [p.imagePath]));
  if (viewed.length) {
    await images.closeViews(viewed).catch((e: unknown) => {
      if (__DEV__) console.warn("closeViews failed", e);
    });
  }
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
  if (paths.size) {
    await images.deleteFiles([...paths]).catch((e: unknown) => {
      if (__DEV__) console.warn("deleteFiles failed", e);
    });
  }
}

/**
 * State and actions of the draft review screen. Every edit is written through to the draft row
 * 300 ms after the last keystroke, and immediately when the app goes to the background or the
 * screen unmounts (fold/unfold, close), so nothing typed is lost. `save` validates, refreshes FX
 * rates for the purchase date (best effort), recomputes the home amount, confirms the receipt
 * and opens the next queued draft (or closes); `discard` deletes the draft and unshared photos.
 *
 * Edit mode (a confirmed receipt): no write-through and no duplicate check; `save` validates and
 * writes the same patch in one update, status stays confirmed, then goes back. FX is recomputed
 * only when currency, total, date or the manual rate changed, or the row is not converted for
 * the current home. Leaving with unsaved changes (Cancel, Android back, iOS swipe-dismiss) asks
 * "Discard changes?" first.
 */
export function useReviewForm(
  id: string,
  opts: { queue?: string[]; mode?: ReviewFormMode } = {},
): ReviewForm {
  const { t } = useTranslation();
  const db = useDb();
  const images = useImageStore();
  const prefs = usePrefs();
  const home = usePref("homeCurrency") ?? "USD";
  const queueRef = useRef(opts.queue ?? []);
  // Fixed for the screen's lifetime, like the id.
  const [mode] = useState<ReviewFormMode>(opts.mode ?? "review");
  const editing = mode === "edit";

  // The DB is synchronous, so the receipt is read once while the screen mounts. A new id comes
  // with a new screen (router.replace), never with new props on this one.
  const [loaded] = useState(() => loadReceipt(db, id, mode));
  const receipt = loaded === "missing" ? "missing" : loaded.receipt;
  const pages = loaded === "missing" ? NO_PAGES : loaded.pages;
  const [confidence] = useState(() => (loaded === "missing" ? null : parseConfidence(loaded.receipt.parseConfidence)));
  const [initialValues] = useState<ReviewValues>(() => (loaded === "missing" ? EMPTY : valuesFromReceipt(loaded.receipt)));
  const [values, setValues] = useState<ReviewValues>(initialValues);
  const [edited, setEdited] = useState<Set<keyof FieldConfidence>>(() => new Set());
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>(() =>
    loaded === "missing" || editing ? [] : findDuplicates(db, loaded.receipt, pageHashes(loaded.pages)),
  );
  const [errors, setErrors] = useState<ReviewErrors>({});
  const [fxCache, setFxCache] = useState<FxCache>(() => prefs.get("fxTables"));
  const [busy, setBusy] = useState(false);
  // Set once leaving is decided (saved, or changes discarded): lifts the back / swipe guard.
  const [leaving, setLeaving] = useState(false);

  // Latest state for timers / AppState / unmount callbacks.
  const valuesRef = useRef(values);
  const receiptRef = useRef<Receipt | null>(loaded === "missing" ? null : loaded.receipt);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  // One save/discard at a time: a double tap or Save + "Save anyway" must not confirm or navigate twice.
  const inFlight = useRef(false);
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
      if (editing) return; // nothing is written before Save
      dirty.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        flush();
        if (receiptRef.current) refreshDuplicates(receiptRef.current);
      }, WRITE_DEBOUNCE_MS);
    },
    [editing, flush, refreshDuplicates],
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
        const merged = mergeFxCache(prefs.get("fxTables"), next);
        prefs.set("fxTables", merged);
        if (!cancelled) setFxCache(merged);
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

  /** Edit mode: asks "Discard changes?" and calls `leave` on Discard. */
  const confirmDiscard = useCallback(
    (leave: () => void) => {
      Alert.alert(t("review.discardChangesTitle"), undefined, [
        { text: t("review.keepEditing"), style: "cancel" },
        {
          text: t("review.discard"),
          style: "destructive",
          onPress: () => {
            setLeaving(true);
            leave();
          },
        },
      ]);
    },
    [t],
  );

  // Edit mode: Android back and iOS swipe-dismiss ask before dropping unsaved changes, like Cancel.
  const changed = editing && hasChanges(values, initialValues);
  const disablePrevention = usePreventRemove(changed && !leaving, ({ repeat }) => confirmDiscard(repeat));

  const save = useCallback(async () => {
    const r = receiptRef.current;
    if (!r || inFlight.current) return;
    flush();
    const v = valuesRef.current;
    const errs = validate(v);
    setErrors(errs);
    if (Object.keys(errs).length) throw new ReviewValidationError(errs);
    inFlight.current = true;
    setBusy(true);
    try {
      // Edit: nothing that drives the conversion changed and the row is already converted for
      // this home, so keep the stored conversion (an offline cache must not downgrade it).
      const keepFx =
        editing &&
        FX_DRIVERS.every((k) => v[k] === initialValues[k]) &&
        r.homeCurrencyAtSave === home &&
        r.amountHomeMinor !== null;
      let cache = prefs.get("fxTables");
      if (!keepFx && v.currency.toUpperCase() !== home.toUpperCase() && !v.fxRate.trim()) {
        try {
          const next = await ensureRates(cache, home, v.date, Date.now());
          if (next !== cache) {
            cache = mergeFxCache(prefs.get("fxTables"), next);
            prefs.set("fxTables", cache);
          }
        } catch {
          // best effort: offline saves with amountHomeMinor null (filled in by a later FX sync)
        }
      }
      const patch = draftPatch(r, v, home, cache);
      if (keepFx) {
        delete patch.fxRate;
        delete patch.fxRateDate;
        delete patch.amountHomeMinor;
        delete patch.fxApproximate;
        delete patch.homeCurrencyAtSave;
      }
      // Edit: same columns, status untouched (stays confirmed).
      updateReceipt(db, r.id, editing ? patch : { ...patch, status: "confirmed" });
      // Only after the write committed (a throw above skips this); edits are not new receipts.
      if (!editing) prefs.set("receiptsSinceBackup", prefs.get("receiptsSinceBackup") + 1);
      receiptRef.current = null; // saved: no write-through (and no second save) after this point
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
    if (editing) {
      setLeaving(true);
      disablePrevention(); // Save's own navigation must not hit the unsaved-changes guard
      router.back();
    } else goNext(queueRef.current);
  }, [db, disablePrevention, editing, flush, home, initialValues, prefs]);

  const discard = useCallback(async () => {
    const r = receiptRef.current;
    if (editing || !r || inFlight.current) return;
    inFlight.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    dirty.current = false;
    receiptRef.current = null;
    setBusy(true);
    try {
      await discardReceipt(db, images, r.id);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
    goNext(queueRef.current);
  }, [db, editing, images]);

  const cancel = useCallback(() => {
    if (inFlight.current) return;
    // Review mode writes through as you type, so leaving never loses anything there.
    if (!editing || !hasChanges(valuesRef.current, initialValues)) {
      router.back();
      return;
    }
    confirmDiscard(() => {
      disablePrevention();
      router.back();
    });
  }, [confirmDiscard, disablePrevention, editing, initialValues]);

  return { mode, receipt, pages, values, setField, lowConfidence, duplicates, errors, home, fx, busy, save, discard, cancel };
}
