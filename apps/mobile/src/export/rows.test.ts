import { createFolder, softDeleteFolder } from "../db/repositories/folders";
import { createReceipt, softDeleteReceipt } from "../db/repositories/receipts";
import { testDb } from "../db/testing/testDb";
import type { NewReceiptInput } from "../db/types";
import { loadExportRows } from "./rows";

function seed(db: ReturnType<typeof testDb>, over: Partial<NewReceiptInput> = {}) {
  return createReceipt(db, {
    merchant: "Toko",
    purchasedAtLocal: "2026-03-01T10:00:00",
    purchasedTz: "Asia/Jakarta",
    purchasedAtUtc: 1772334000000,
    scannedAtUtc: 1772334060000,
    currency: "IDR",
    totalMinor: 12500,
    parseSource: "manual",
    status: "confirmed",
    ...over,
  });
}

const label = () => "Cat";

describe("loadExportRows", () => {
  it("returns confirmed live rows only, newest first", () => {
    const db = testDb();
    seed(db, { status: "draft" });
    softDeleteReceipt(db, seed(db).id);
    const a = seed(db, { purchasedAtLocal: "2026-03-02T10:00:00" });
    const b = seed(db, { purchasedAtLocal: "2026-03-03T09:30:00" });
    const rows = loadExportRows(db, {}, label);
    expect(rows.map((r) => r.id)).toEqual([b.id, a.id]);
    expect(rows[0]).toMatchObject({ date: "2026-03-03", time: "09:30", timezone: "Asia/Jakarta" });
    expect(rows[0].receipt.id).toBe(b.id);
  });

  it("returns 1,201 receipts complete across chunk boundaries", () => {
    const db = testDb();
    const ids = new Set<string>();
    for (let i = 0; i < 1201; i++) {
      ids.add(seed(db, { purchasedAtLocal: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T10:00:00` }).id);
    }
    const rows = loadExportRows(db, {}, label);
    expect(rows).toHaveLength(1201);
    expect(new Set(rows.map((r) => r.id))).toEqual(ids);
  });

  it("formats totals with fromMinor and blanks missing home amount", () => {
    const db = testDb();
    seed(db, { purchasedAtLocal: "2026-03-02T10:00:00", currency: "USD", totalMinor: 450, taxMinor: 50 });
    seed(db, { purchasedAtLocal: "2026-03-01T10:00:00", currency: "JPY" });
    const [usd, jpy] = loadExportRows(db, {}, label);
    expect(usd.total).toBe("4.50");
    expect(usd.tax).toBe("0.50");
    expect(usd.homeAmount).toBe("");
    expect(jpy.total).toBe("12500");
    expect(jpy.tax).toBe("");
    expect(jpy.fxApproximate).toBe(false);
  });

  it("formats home amount in home currency", () => {
    const db = testDb();
    seed(db, {
      currency: "USD",
      totalMinor: 450,
      homeCurrencyAtSave: "IDR",
      amountHomeMinor: 72000,
      fxRate: "16000",
      fxRateDate: "2026-03-01",
      fxApproximate: true,
    } as Partial<NewReceiptInput>);
    const [r] = loadExportRows(db, {}, label);
    expect(r).toMatchObject({
      homeCurrency: "IDR",
      homeAmount: "720.00",
      fxRate: "16000",
      fxRateDate: "2026-03-01",
      fxApproximate: true,
    });
  });

  it("maps deleted folder to empty string, live folder to its name", () => {
    const db = testDb();
    const live = createFolder(db, { name: "Trip", kind: "trip" });
    const gone = createFolder(db, { name: "Old", kind: "trip" });
    seed(db, { folderId: live.id, purchasedAtLocal: "2026-03-02T10:00:00" });
    seed(db, { folderId: gone.id });
    softDeleteFolder(db, gone.id);
    const rows = loadExportRows(db, {}, label);
    expect(rows.map((r) => r.folder)).toEqual(["Trip", ""]);
  });

  it("applies folderId and date range filters", () => {
    const db = testDb();
    const f = createFolder(db, { name: "Trip", kind: "trip" });
    const a = seed(db, { folderId: f.id, purchasedAtLocal: "2026-03-05T10:00:00" });
    seed(db, { purchasedAtLocal: "2026-03-10T10:00:00" });
    const c = seed(db, { purchasedAtLocal: "2026-04-01T10:00:00" });
    expect(loadExportRows(db, { folderId: f.id }, label).map((r) => r.id)).toEqual([a.id]);
    const ranged = loadExportRows(db, { from: "2026-03-20", to: "2026-04-01" }, label);
    expect(ranged.map((r) => r.id)).toEqual([c.id]);
  });

  it("resolves category label via callback", () => {
    const db = testDb();
    seed(db, { categoryId: "default:other" } as Partial<NewReceiptInput>);
    const rows = loadExportRows(db, {}, (c) => `L:${c.id}`);
    expect(rows[0].category).toBe("L:default:other");
  });
});
