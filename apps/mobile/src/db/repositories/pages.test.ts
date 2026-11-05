import { testDb } from "../testing/testDb";
import { createReceipt } from "./receipts";
import { countPagesByImagePath, createPage, listAllPagePaths, listPageHashes, listPages, softDeletePages } from "./pages";
import { receiptPages } from "../schema";
import { eq } from "drizzle-orm";

function mkReceipt(db: ReturnType<typeof testDb>) {
  return createReceipt(db, {
    merchant: "X",
    purchasedAtLocal: "2026-03-01T10:00:00",
    purchasedAtUtc: 1,
    scannedAtUtc: 1,
    currency: "IDR",
    totalMinor: 1,
    parseSource: "manual",
  });
}

const page = (receiptId: string, pageIndex: number, over = {}) => ({
  receiptId,
  pageIndex,
  imagePath: `img${pageIndex}`,
  thumbPath: `th${pageIndex}`,
  width: 10,
  height: 20,
  dhash: null as string | null,
  ...over,
});

describe("pages repository", () => {
  it("create then list orders by pageIndex", () => {
    const db = testDb();
    const r = mkReceipt(db);
    createPage(db, page(r.id, 1));
    const p0 = createPage(db, page(r.id, 0, { dhash: "ab" }));
    expect(p0.dhash).toBe("ab");
    expect(listPages(db, r.id).map((p) => p.pageIndex)).toEqual([0, 1]);
  });

  it("excludes soft-deleted pages", () => {
    const db = testDb();
    const r = mkReceipt(db);
    const p = createPage(db, page(r.id, 0, { dhash: "ab" }));
    createPage(db, page(r.id, 1));
    db.update(receiptPages).set({ deletedAt: 5 }).where(eq(receiptPages.id, p.id)).run();
    expect(listPages(db, r.id).map((x) => x.pageIndex)).toEqual([1]);
    expect(listAllPagePaths(db)).toEqual(["img1", "th1"]);
    expect(listPageHashes(db)).toEqual([]);
  });

  it("listAllPagePaths includes thumbs, skips null thumb", () => {
    const db = testDb();
    const r = mkReceipt(db);
    createPage(db, page(r.id, 0));
    createPage(db, page(r.id, 1, { thumbPath: null }));
    expect(listAllPagePaths(db).sort()).toEqual(["img0", "img1", "th0"]);
  });

  it("listPageHashes returns pages with a dhash", () => {
    const db = testDb();
    const r = mkReceipt(db);
    createPage(db, page(r.id, 0, { dhash: "ff00" }));
    createPage(db, page(r.id, 1));
    expect(listPageHashes(db)).toEqual([{ receiptId: r.id, dhash: "ff00", imagePath: expect.any(String) }]);
  });
});

describe("page file sharing (discard)", () => {
  it("countPagesByImagePath counts live pages of other receipts only", () => {
    const db = testDb();
    const a = mkReceipt(db);
    const b = mkReceipt(db);
    createPage(db, page(a.id, 0, { imagePath: "pages/shared.enc" }));
    createPage(db, page(b.id, 0, { imagePath: "pages/shared.enc" }));
    expect(countPagesByImagePath(db, "pages/shared.enc", a.id)).toBe(1);
    softDeletePages(db, b.id);
    expect(countPagesByImagePath(db, "pages/shared.enc", a.id)).toBe(0);
    expect(listPages(db, b.id)).toEqual([]);
    expect(listPages(db, a.id)).toHaveLength(1);
  });
});
