import { createPage } from "../db/repositories/pages";
import { createReceipt } from "../db/repositories/receipts";
import { testDb } from "../db/testing/testDb";
import type { NewReceiptInput } from "../db/types";
import { formatMoney } from "../money/money";
import { buildReportHtml, buildReportInput, type ReportInput } from "./reportHtml";
import { loadExportRows, type ExportRow } from "./rows";

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
    homeCurrencyAtSave: "IDR",
    amountHomeMinor: 12500,
    ...over,
  });
}

const t = (key: string, opts?: object) =>
  opts && "count" in opts ? `${(opts as { count: number }).count} not converted` : key;

function rowsOf(over: Partial<NewReceiptInput>[]): ExportRow[] {
  const db = testDb();
  for (const o of over) seed(db, o);
  return loadExportRows(db, {}, () => "Cat");
}

function input(over: Partial<ReportInput> = {}): ReportInput {
  const [row] = rowsOf([{}]);
  return {
    title: "Report",
    rangeLabel: "All",
    generatedAt: "2026-11-07",
    home: "IDR",
    locale: "en",
    total: { homeMinor: 12500, count: 1, unconverted: 0 },
    months: [{ label: "March 2026", total: { homeMinor: 12500, count: 1, unconverted: 0 }, rows: [{ row, thumbDataUri: null }] }],
    byCategory: [{ label: "Cat", homeMinor: 12500 }],
    thumbFailures: 0,
    t,
    ...over,
  };
}

describe("buildReportHtml", () => {
  it("escapes merchant", () => {
    const [row] = rowsOf([{ merchant: "<script>alert(1)</script>" }]);
    const html = buildReportHtml(input({ months: [{ label: "M", total: { homeMinor: 0, count: 1, unconverted: 0 }, rows: [{ row, thumbDataUri: null }] }] }));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("has no http and renders grand total", () => {
    const html = buildReportHtml(input({ total: { homeMinor: 987600, count: 3, unconverted: 0 } }));
    expect(html).not.toContain("http");
    expect(html).toContain(formatMoney(987600, "IDR", "en"));
  });

  it("shows not-converted count and dash for unconverted row", () => {
    const [row] = rowsOf([{ currency: "USD", totalMinor: 500, homeCurrencyAtSave: null, amountHomeMinor: null }]);
    const html = buildReportHtml(
      input({
        total: { homeMinor: 0, count: 1, unconverted: 2 },
        months: [{ label: "M", total: { homeMinor: 0, count: 1, unconverted: 1 }, rows: [{ row, thumbDataUri: null }] }],
      }),
    );
    expect(html).toContain("2 not converted");
    expect(html).toContain(">—<");
  });

  it("marks approximate rows", () => {
    const [row] = rowsOf([{ currency: "USD", totalMinor: 500, homeCurrencyAtSave: "IDR", amountHomeMinor: 8000000, fxApproximate: true }]);
    const html = buildReportHtml(input({ months: [{ label: "M", total: { homeMinor: 8000000, count: 1, unconverted: 0 }, rows: [{ row, thumbDataUri: null }] }] }));
    expect(html).toContain("≈");
  });

  it("img only when thumb present", () => {
    expect(buildReportHtml(input())).not.toContain("<img");
    const [row] = rowsOf([{}]);
    const html = buildReportHtml(input({ months: [{ label: "M", total: { homeMinor: 0, count: 1, unconverted: 0 }, rows: [{ row, thumbDataUri: "data:image/jpeg;base64,AAAA" }] }] }));
    expect(html).toContain('<img src="data:image/jpeg;base64,AAAA"');
  });

  it("keeps month order", () => {
    const m = (label: string) => ({ label, total: { homeMinor: 0, count: 0, unconverted: 0 }, rows: [] });
    const html = buildReportHtml(input({ months: [m("ZZZ"), m("AAA")] }));
    expect(html.indexOf("ZZZ")).toBeLessThan(html.indexOf("AAA"));
  });
});

describe("buildReportInput", () => {
  it("groups by month, sums converted only by category, thumbs optional", async () => {
    const db = testDb();
    seed(db, { purchasedAtLocal: "2026-03-05T10:00:00", totalMinor: 100, amountHomeMinor: 100 });
    seed(db, { purchasedAtLocal: "2026-02-05T10:00:00", currency: "USD", homeCurrencyAtSave: null, amountHomeMinor: null });
    const store = { readPlain: jest.fn(async () => new Uint8Array([1, 2, 3])) };
    const base = {
      db, store: store as never, filter: {}, home: "IDR", locale: "en", t, title: "T", rangeLabel: "R",
      now: new Date("2026-11-07T00:00:00Z"),
    };
    const r = await buildReportInput({ ...base, includeThumbs: false });
    expect(r.months.map((m) => m.label)).toEqual(["March 2026", "February 2026"]);
    expect(r.total).toEqual({ homeMinor: 100, count: 2, unconverted: 1 });
    expect(r.byCategory.reduce((s, c) => s + c.homeMinor, 0)).toBe(100);
    expect(store.readPlain).not.toHaveBeenCalled();
    expect(r.months[0].rows[0].thumbDataUri).toBeNull();
  });

  it("includes thumbs from page 0 and gives per-category sums", async () => {
    const db = testDb();
    const a = seed(db, { totalMinor: 100, amountHomeMinor: 100, categoryId: "default:other" });
    seed(db, { merchant: "B", totalMinor: 40, amountHomeMinor: 40, categoryId: "default:other" });
    createPage(db, { receiptId: a.id, pageIndex: 0, imagePath: "pages/i.enc", thumbPath: "pages/t0.enc", width: 1, height: 1, dhash: null });
    createPage(db, { receiptId: a.id, pageIndex: 1, imagePath: "pages/j.enc", thumbPath: "pages/t1.enc", width: 1, height: 1, dhash: null });
    const store = { readPlain: jest.fn(async () => new Uint8Array([1, 2, 3])) };
    const r = await buildReportInput({
      db, store: store as never, filter: {}, home: "IDR", locale: "en", t, title: "T", rangeLabel: "R",
      now: new Date("2026-11-07T00:00:00Z"), includeThumbs: true,
    });
    expect(store.readPlain).toHaveBeenCalledTimes(1);
    expect(store.readPlain).toHaveBeenCalledWith("pages/t0.enc");
    const uris = r.months.flatMap((m) => m.rows.map((x) => x.thumbDataUri));
    expect(uris.filter(Boolean)).toEqual(["data:image/jpeg;base64,AQID"]);
    expect(r.byCategory).toEqual([{ label: "categories.other", homeMinor: 140 }]);
    expect(r.thumbFailures).toBe(0);
  });

  it("counts thumbnail failures and still renders rows", async () => {
    const db = testDb();
    const a = seed(db);
    createPage(db, { receiptId: a.id, pageIndex: 0, imagePath: "pages/i.enc", thumbPath: "pages/t0.enc", width: 1, height: 1, dhash: null });
    const store = { readPlain: jest.fn(async () => { throw new Error("auth"); }) };
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = await buildReportInput({
      db, store: store as never, filter: {}, home: "IDR", locale: "en", t, title: "T", rangeLabel: "R",
      now: new Date("2026-11-07T00:00:00Z"), includeThumbs: true,
    });
    warn.mockRestore();
    expect(r.thumbFailures).toBe(1);
    expect(r.months[0].rows).toHaveLength(1);
    expect(buildReportHtml(r)).not.toContain("<img");
  });
});
