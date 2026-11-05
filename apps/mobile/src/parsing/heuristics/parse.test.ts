import { toMinor } from "@/money/money";

import { parseHeuristic } from "./index";

const hints = { homeCurrency: "IDR", today: new Date(2026, 10, 5) };
const idr = (v: string) => toMinor(v, "IDR");

describe("parseHeuristic", () => {
  it("prefers Total Transaksi over Nominal and Biaya Admin", () => {
    const r = parseHeuristic(
      [
        "Transfer Berhasil!",
        "02 Nov 2026 • 10:15:02 WIB",
        "Nominal Transfer  Rp 750.000",
        "Metode Transfer  BI Fast",
        "Biaya Admin  Rp 2.500",
        "Total Transaksi  Rp 752.500",
      ],
      hints,
    );
    expect(r.totalMinor).toBe(idr("752500"));
    expect(r.currency).toBe("IDR");
    expect(r.purchasedDate).toBe("2026-11-02");
    expect(r.purchasedTime).toBe("10:15");
    expect(r.source).toBe("heuristic");
  });

  it("skips subtotal and discount", () => {
    const r = parseHeuristic(
      [
        "INDOMARET CABANG MERDEKA",
        "JL. MERDEKA NO. 7",
        "03.10.26-18:05/4.5.0/T101-22222/KASIR/01",
        "ROTI TAWAR  2  8000  16,000",
        "SUSU UHT  2  8000  16,000",
        "SUBTOTAL : 32.000",
        "DISKON :  (8,000)",
        "TOTAL BELANJA : 24.000",
        "KEMBALI : 26.000",
        "PPN  : DPP= 27,665 PPN= 3,320",
      ],
      hints,
    );
    expect(r.totalMinor).toBe(idr("24000"));
    expect(r.taxMinor).toBe(idr("3320"));
    expect(r.purchasedDate).toBe("2026-10-03");
    expect(r.categoryId).toBe("default:groceries");
  });

  it("returns nulls for non-receipt text", () => {
    const r = parseHeuristic(
      ["Daftar belanja minggu ini", "- beli 3 kursi lipat", "- telepon tukang listrik", "Jangan lupa!"],
      hints,
    );
    expect(r).toEqual({
      merchant: null,
      purchasedDate: null,
      purchasedTime: null,
      currency: "IDR",
      totalMinor: null,
      taxMinor: null,
      categoryId: null,
      refNo: null,
      confidence: { merchant: 0, date: 0, total: 0, tax: 0, currency: 0, category: 0 },
      source: "heuristic",
    });
  });

  it("extracts waybill ref", () => {
    const r = parseHeuristic(
      ["SICEPAT EXPRESS", "KX4401928374", "Penerima: BUDI", "TOTAL ONGKIR", "IDR 18,000", "Tgl: 04-11-2026"],
      hints,
    );
    expect(r.refNo).toBe("KX4401928374");
    expect(r.totalMinor).toBe(idr("18000"));
    expect(r.purchasedDate).toBe("2026-11-04");
  });

  it("classifies BI Fast as transfer", () => {
    const r = parseHeuristic(
      ["Transaksi Sukses", "3 Nov 2026, 09:12 WIB", "BI Fast", "Nominal  Rp150.000", "No. Referensi  ABC1234567"],
      hints,
    );
    expect(r.categoryId).toBe("default:transfer");
    expect(r.totalMinor).toBe(idr("150000"));
    expect(r.refNo).toBe("ABC1234567");
  });

  it("ignores digits inside dates and times when falling back", () => {
    const r = parseHeuristic(["Jam 13.41", "27 Sep 2026", "Rp 5.000"], hints);
    expect(r.totalMinor).toBe(idr("5000"));
    expect(r.confidence.total).toBe(0.3);
  });

  it("swaps an ambiguous numeric date that would land in the future", () => {
    const r = parseHeuristic(["Date: 11/10/2026", "TOTAL $14.80"], hints);
    expect(r.purchasedDate).toBe("2026-10-11");
  });
});
