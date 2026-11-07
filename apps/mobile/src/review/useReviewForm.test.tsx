import { act, renderHook } from "@testing-library/react-native";
import { Alert, AppState, type AlertButton } from "react-native";

import { createFolder } from "@/db/repositories/folders";

import { createPage, listPages } from "@/db/repositories/pages";
import { createReceipt, getReceipt } from "@/db/repositories/receipts";
import { testDb } from "@/db/testing/testDb";
import type { AppDb, NewReceiptInput } from "@/db/types";
import { initI18n } from "@/i18n";
import { createPrefs, type FxCache, type PrefsStore } from "@/prefs/prefs";

import { ReviewValidationError, useReviewForm, WRITE_DEBOUNCE_MS } from "./useReviewForm";

let mockDb: AppDb;
let mockPrefs: PrefsStore;
const mockDeleted: string[] = [];
const mockClosed: string[] = [];
const mockImages = {
  openForView: jest.fn(async (p: string) => `file:///cache/view/${p}`),
  deleteFiles: jest.fn(async (paths: string[]) => void mockDeleted.push(...paths)),
  closeViews: jest.fn(async (paths: string[]) => void mockClosed.push(...paths)),
};
const mockRouter = { replace: jest.fn(), back: jest.fn() };

jest.mock("@/db/DatabaseProvider", () => ({ useDb: () => mockDb }));
jest.mock("@/images/ImageStoreProvider", () => ({ useImageStore: () => mockImages }));
jest.mock("@/prefs/PrefsProvider", () => ({
  usePrefs: () => mockPrefs,
  usePref: (k: "homeCurrency") => mockPrefs.get(k),
}));
jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
}));

type AppStateListener = (s: string) => void;
let appStateListener: AppStateListener | null = null;

function memoryPrefs(): PrefsStore {
  const m = new Map<string, string>();
  return createPrefs({ getString: (k) => m.get(k), set: (k, v) => void m.set(k, v), delete: (k) => void m.delete(k) });
}

function draft(over: Partial<NewReceiptInput> = {}) {
  return createReceipt(mockDb, {
    status: "draft",
    merchant: "Toko Maju",
    purchasedAtLocal: "2026-11-03T10:15:00",
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: Date.UTC(2026, 10, 3, 3, 15),
    scannedAtUtc: Date.UTC(2026, 10, 5, 5, 0),
    scannedTz: "Asia/Jakarta",
    currency: "IDR",
    totalMinor: 2500000,
    taxMinor: null,
    homeCurrencyAtSave: "IDR",
    parseSource: "heuristic",
    parseConfidence: JSON.stringify({ merchant: 0.9, date: 0.9, total: 0.9, tax: 0, currency: 0.9, category: 0 }),
    ...over,
  });
}

async function mount(id: string, queue: string[] = []) {
  const hook = await renderHook(() => useReviewForm(id, { queue }));
  return hook;
}

beforeAll(() => initI18n("en"));

beforeEach(() => {
  mockDb = testDb();
  mockPrefs = memoryPrefs();
  mockPrefs.set("homeCurrency", "IDR");
  mockDeleted.length = 0;
  mockClosed.length = 0;
  jest.clearAllMocks();
  appStateListener = null;
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_: string, cb: AppStateListener) => {
    appStateListener = cb;
    return { remove: jest.fn() };
  }) as never);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("useReviewForm", () => {
  it("writes edits through to the draft", async () => {
    jest.useFakeTimers();
    const r = draft();
    const { result, unmount } = await mount(r.id);
    expect(result.current.values.merchant).toBe("Toko Maju");
    expect(result.current.values.total).toBe("25000");

    await act(async () => result.current.setField("merchant", "Warung Sari"));
    await act(async () => result.current.setField("total", "30.000,50"));
    // Debounced: nothing written before 300 ms.
    await act(async () => void jest.advanceTimersByTime(299));
    expect(getReceipt(mockDb, r.id)?.merchant).toBe("Toko Maju");
    await act(async () => void jest.advanceTimersByTime(1));
    expect(getReceipt(mockDb, r.id)).toMatchObject({ merchant: "Warung Sari", totalMinor: 3000050, status: "draft" });

    // Backgrounding flushes a pending edit immediately.
    await act(async () => result.current.setField("notes", "lunch"));
    await act(async () => appStateListener?.("background"));
    expect(getReceipt(mockDb, r.id)?.notes).toBe("lunch");

    // Unmount (fold/unfold remount, close) flushes too.
    await act(async () => result.current.setField("date", "2026-11-04"));
    await unmount();
    expect(getReceipt(mockDb, r.id)?.purchasedAtLocal).toBe("2026-11-04T10:15:00");
  });

  it("save rejects missing total", async () => {
    // Ruling X: total 0 at confidence 0 = no total.
    const r = draft({
      totalMinor: 0,
      parseSource: "manual",
      parseConfidence: JSON.stringify({ merchant: 0, date: 0, total: 0, tax: 0, currency: 0, category: 0 }),
    });
    const { result } = await mount(r.id);
    expect(result.current.values.total).toBe("");
    let err: unknown;
    await act(async () => {
      await result.current.save().catch((e: unknown) => (err = e));
    });
    expect(err).toBeInstanceOf(ReviewValidationError);
    expect(result.current.errors.total).toBe("review.errors.totalRequired");
    expect(getReceipt(mockDb, r.id)?.status).toBe("draft");
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it("save confirms and recomputes FX", async () => {
    const cache: FxCache = { base: "idr", latestDate: "2026-11-04", fetchedAt: Date.now(), byDate: {} };
    mockPrefs.set("fxTables", cache);
    const fetchFn = jest.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({ date: url.includes("2026-11-03") ? "2026-11-03" : "2026-11-04", idr: { usd: 0.00005, eur: 0.00004 } }),
    }));
    global.fetch = fetchFn as unknown as typeof fetch;
    const r = draft({ currency: "USD", totalMinor: 1234, amountHomeMinor: null, fxRate: null });
    const next = draft();
    const { result } = await mount(r.id, [next.id]);

    await act(async () => {
      await result.current.save();
    });
    expect(fetchFn).toHaveBeenCalled();
    expect(getReceipt(mockDb, r.id)).toMatchObject({
      status: "confirmed",
      fxRate: "20000",
      fxRateDate: "2026-11-03",
      fxApproximate: false,
      amountHomeMinor: 24680000,
      homeCurrencyAtSave: "IDR",
    });
    expect(mockPrefs.get("fxTables").byDate["2026-11-03"]).toEqual({ usd: "0.00005", eur: "0.00004" });
    expect(mockRouter.replace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/review/[id]", params: expect.objectContaining({ id: next.id, queue: "" }) }),
    );

    // Manual rate override: stored as exact (not approximate) and the home amount follows it.
    const { result: second } = await mount(next.id);
    await act(async () => second.current.setField("currency", "USD"));
    await act(async () => second.current.setField("total", "12.34"));
    await act(async () => second.current.setField("fxRate", "16000"));
    await act(async () => {
      await second.current.save();
    });
    expect(getReceipt(mockDb, next.id)).toMatchObject({
      status: "confirmed",
      currency: "USD",
      fxRate: "16000",
      fxRateDate: null,
      fxApproximate: false,
      amountHomeMinor: 19744000,
    });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("discard deletes files not shared with a split sibling", async () => {
    const a = draft();
    const b = draft();
    for (const r of [a, b]) {
      createPage(mockDb, { receiptId: r.id, pageIndex: 0, imagePath: "pages/shared.enc", thumbPath: "pages/shared-t.enc", width: 10, height: 10, dhash: null });
    }
    createPage(mockDb, { receiptId: a.id, pageIndex: 1, imagePath: "pages/own.enc", thumbPath: "pages/own-t.enc", width: 10, height: 10, dhash: null });

    const { result } = await mount(a.id);
    await act(async () => {
      await result.current.discard();
    });
    expect(getReceipt(mockDb, a.id)).toBeNull();
    expect(listPages(mockDb, a.id)).toEqual([]);
    expect(mockDeleted.sort()).toEqual(["pages/own-t.enc", "pages/own.enc"]);
    // Decrypted view copies of every discarded page go now, not at the next background purge.
    expect(mockClosed.sort()).toEqual(["pages/own-t.enc", "pages/own.enc", "pages/shared-t.enc", "pages/shared.enc"]);

    // The last receipt using the shared photo takes its files with it.
    const { result: sib } = await mount(b.id);
    await act(async () => {
      await sib.current.discard();
    });
    expect(mockDeleted.sort()).toEqual(["pages/own-t.enc", "pages/own.enc", "pages/shared-t.enc", "pages/shared.enc"]);
  });

  it("exposes low-confidence fields from parse_confidence", async () => {
    const r = draft({
      parseConfidence: JSON.stringify({ merchant: 0.4, date: 0.95, total: 0.59, tax: 0.6, currency: 0.9, category: 0.2 }),
    });
    const { result } = await mount(r.id);
    expect([...result.current.lowConfidence].sort()).toEqual(["category", "merchant", "total"]);
    // Editing a field is the user checking it.
    await act(async () => result.current.setField("merchant", "Toko Baru"));
    expect([...result.current.lowConfidence].sort()).toEqual(["category", "total"]);
  });

  it("lists duplicates excluding self", async () => {
    const saved = draft({ status: "confirmed", refNo: "INV-77" });
    const similar = draft({ status: "confirmed", merchant: "Toko Maju Jaya" });
    const r = draft({ refNo: "INV-77" });
    const { result } = await mount(r.id);
    expect(result.current.duplicates).toEqual([
      { receiptId: saved.id, strength: "exact-ref" },
      { receiptId: similar.id, strength: "similar" },
    ]);
    expect(result.current.duplicates.some((d) => d.receiptId === r.id)).toBe(false);
  });

  it("discard still leaves the screen when deleting files fails", async () => {
    const r = draft();
    createPage(mockDb, { receiptId: r.id, pageIndex: 0, imagePath: "pages/own.enc", thumbPath: null, width: 10, height: 10, dhash: null });
    mockImages.deleteFiles.mockRejectedValueOnce(new Error("disk"));
    mockImages.closeViews.mockRejectedValueOnce(new Error("disk"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const { result } = await mount(r.id);
    await act(async () => {
      await result.current.discard();
    });
    expect(getReceipt(mockDb, r.id)).toBeNull();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(false);
    warn.mockRestore();
  });

  it("save runs once for a double tap or Save + Save anyway", async () => {
    let release!: () => void;
    const gate = new Promise<void>((res) => (release = res));
    global.fetch = jest.fn(async () => {
      await gate;
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    const r = draft({ currency: "USD", totalMinor: 1234 });
    const { result } = await mount(r.id);
    await act(async () => {
      const first = result.current.save();
      const second = result.current.save();
      release();
      await Promise.all([first, second]);
    });
    expect(getReceipt(mockDb, r.id)).toMatchObject({ status: "confirmed", version: 2 });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it("saves the folder chosen on review with the draft", async () => {
    const folder = createFolder(mockDb, { name: "Office", kind: "project" });
    const r = draft();
    const { result } = await mount(r.id);
    expect(result.current.values.folderId).toBeNull();
    await act(async () => result.current.setField("folderId", folder.id));
    await act(async () => {
      await result.current.save();
    });
    expect(getReceipt(mockDb, r.id)).toMatchObject({ status: "confirmed", folderId: folder.id });
  });
});

describe("useReviewForm edit mode", () => {
  const cache: FxCache = {
    base: "idr",
    latestDate: "2026-11-03",
    fetchedAt: Date.now(),
    byDate: { "2026-11-03": { usd: "0.00005" } },
  };

  function confirmed(over: Partial<NewReceiptInput> = {}) {
    return draft({ status: "confirmed", amountHomeMinor: 2500000, ...over });
  }

  async function mountEdit(id: string) {
    return renderHook(() => useReviewForm(id, { mode: "edit" }));
  }

  it("writes nothing before save, then saves once and stays confirmed", async () => {
    jest.useFakeTimers();
    const r = confirmed();
    const before = getReceipt(mockDb, r.id)!;
    const { result, unmount } = await mountEdit(r.id);
    expect(result.current.receipt).not.toBe("missing");
    expect(result.current.duplicates).toEqual([]);

    await act(async () => result.current.setField("merchant", "X"));
    await act(async () => void jest.advanceTimersByTime(WRITE_DEBOUNCE_MS * 3));
    await act(async () => appStateListener?.("background"));
    expect(getReceipt(mockDb, r.id)).toEqual(before);

    await act(async () => {
      await result.current.save();
    });
    expect(getReceipt(mockDb, r.id)).toMatchObject({ merchant: "X", status: "confirmed", version: before.version + 1 });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();

    // Unmount after save writes nothing more.
    await unmount();
    expect(getReceipt(mockDb, r.id)?.version).toBe(before.version + 1);
  });

  it("recomputes the home amount from the cached rate when the total changes", async () => {
    mockPrefs.set("fxTables", cache);
    const fetchFn = jest.fn(async () => {
      throw new TypeError("offline");
    });
    global.fetch = fetchFn as unknown as typeof fetch;
    const r = confirmed({ currency: "USD", totalMinor: 1234, amountHomeMinor: 24680000, fxRate: "20000", fxRateDate: "2026-11-03" });
    const { result } = await mountEdit(r.id);
    await act(async () => result.current.setField("total", "20"));
    await act(async () => {
      await result.current.save();
    });
    expect(getReceipt(mockDb, r.id)).toMatchObject({
      status: "confirmed",
      totalMinor: 2000,
      amountHomeMinor: 40000000,
      fxRate: "20000",
      fxRateDate: "2026-11-03",
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("cancel with no changes goes straight back", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    const r = confirmed();
    const { result } = await mountEdit(r.id);
    await act(async () => result.current.cancel());
    expect(alert).not.toHaveBeenCalled();
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("cancel after changes asks, then goes back without writing", async () => {
    let buttons: AlertButton[] = [];
    const alert = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, b) => void (buttons = b ?? []));
    const r = confirmed();
    const before = getReceipt(mockDb, r.id)!;
    const { result, unmount } = await mountEdit(r.id);
    await act(async () => result.current.setField("merchant", "Changed"));
    await act(async () => result.current.cancel());
    expect(alert).toHaveBeenCalledWith("Discard changes?", undefined, expect.any(Array));
    expect(mockRouter.back).not.toHaveBeenCalled();
    await act(async () => buttons.find((b) => b.style === "destructive")?.onPress?.());
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    await unmount();
    expect(getReceipt(mockDb, r.id)).toEqual(before);
  });

  it("treats a draft or unknown id as missing", async () => {
    const d = draft();
    const { result } = await mountEdit(d.id);
    expect(result.current.receipt).toBe("missing");
    const { result: none } = await mountEdit("nope");
    expect(none.current.receipt).toBe("missing");
  });
});
