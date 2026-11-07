import { notifyDataChanged, subscribeDataChanged } from "./changes";
import { createFolder, renameFolder, softDeleteFolder } from "./repositories/folders";
import { createReceipt, softDeleteReceipt, updateReceipt } from "./repositories/receipts";
import { testDb } from "./testing/testDb";
import type { NewReceiptInput } from "./types";

const input: NewReceiptInput = {
  merchant: "Toko",
  purchasedAtLocal: "2026-03-01T10:00:00",
  purchasedTz: "Asia/Jakarta",
  purchasedAtUtc: 1772334000000,
  scannedAtUtc: 1772334060000,
  currency: "IDR",
  totalMinor: 1000,
  parseSource: "manual",
};

describe("data change emitter", () => {
  it("notify calls subscribers and unsubscribe stops them", () => {
    const cb = jest.fn();
    const off = subscribeDataChanged(cb);
    notifyDataChanged();
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    notifyDataChanged();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("repository writes each notify once", () => {
    const db = testDb();
    const cb = jest.fn();
    const off = subscribeDataChanged(cb);
    const calls = () => cb.mock.calls.length;
    const step = (fn: () => void) => {
      const before = calls();
      fn();
      expect(calls() - before).toBe(1);
    };
    let rid = "";
    let fid = "";
    step(() => {
      rid = createReceipt(db, { ...input, status: "confirmed" }).id;
    });
    step(() => updateReceipt(db, rid, { notes: "x" }));
    step(() => softDeleteReceipt(db, rid));
    step(() => {
      fid = createFolder(db, { name: "A", kind: "trip" }).id;
    });
    step(() => renameFolder(db, fid, "B"));
    step(() => softDeleteFolder(db, fid));
    off();
  });
});
