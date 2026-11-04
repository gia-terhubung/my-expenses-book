import { testDb } from "../testing/testDb";
import { createFolder, listFolders, renameFolder, softDeleteFolder } from "./folders";
import { createReceipt, getReceipt } from "./receipts";

describe("folders repository", () => {
  it("create, list, rename", () => {
    const db = testDb();
    const f = createFolder(db, { name: "Bali", kind: "trip", defaultCurrency: "IDR" });
    expect(f).toMatchObject({ name: "Bali", kind: "trip", defaultCurrency: "IDR", version: 1 });
    const r = renameFolder(db, f.id, "Bali 2026");
    expect(r.version).toBe(2);
    expect(listFolders(db).map((x) => x.name)).toEqual(["Bali 2026"]);
  });

  it("softDeleteFolder hides folder and nulls folder_id on its receipts", () => {
    const db = testDb();
    const f = createFolder(db, { name: "Tax", kind: "project" });
    const keep = createFolder(db, { name: "Other", kind: "project" });
    const mk = (folderId: string) =>
      createReceipt(db, {
        merchant: "X",
        purchasedAtLocal: "2026-01-01T00:00:00",
        purchasedAtUtc: 1,
        scannedAtUtc: 1,
        currency: "USD",
        totalMinor: 100,
        parseSource: "manual",
        folderId,
      });
    const a = mk(f.id);
    const b = mk(keep.id);
    softDeleteFolder(db, f.id);
    expect(listFolders(db).map((x) => x.id)).toEqual([keep.id]);
    const after = getReceipt(db, a.id)!;
    expect(after.folderId).toBeNull();
    expect(after.version).toBe(2);
    expect(getReceipt(db, b.id)!.folderId).toBe(keep.id);
  });
});
