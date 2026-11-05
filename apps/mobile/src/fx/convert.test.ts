import type { FxCache } from "@/prefs/prefs";

import { convertToHome } from "./convert";

function cache(byDate: FxCache["byDate"], base = "idr"): FxCache {
  return { base, latestDate: null, fetchedAt: null, byDate };
}

describe("convertToHome", () => {
  it("same currency needs no table", () => {
    expect(convertToHome(12345, "IDR", "IDR", "2026-11-01", cache({}, ""))).toEqual({
      amountHomeMinor: 12345,
      fxRate: "1",
      fxRateDate: "2026-11-01",
      approximate: false,
    });
  });

  it("missing currency returns null conversion", () => {
    expect(convertToHome(100, "USD", "IDR", "2026-11-01", cache({ "2026-11-01": { eur: "1" } }))).toBeNull();
    expect(convertToHome(100, "USD", "IDR", "2026-11-01", cache({}))).toBeNull();
  });

  it("returns null when table base is not the home currency", () => {
    expect(convertToHome(100, "USD", "IDR", "2026-11-01", cache({ "2026-11-01": { usd: "1" } }, "eur"))).toBeNull();
  });

  it("converts USD 12.34 to IDR (IDR exponent 2)", () => {
    const r = convertToHome(1234, "USD", "IDR", "2026-11-01", cache({ "2026-11-01": { usd: "0.00005" } }));
    expect(r).toEqual({ amountHomeMinor: 24680000, fxRate: "20000", fxRateDate: "2026-11-01", approximate: false });
  });

  it("handles exponent-notation rates", () => {
    // 6.13e-5 USD per IDR -> 1/0.0000613 = 16313.213703... IDR per USD
    expect(String(0.0000613)).toBe("0.0000613");
    const r = convertToHome(1000, "USD", "IDR", "2026-11-01", cache({ "2026-11-01": { usd: "6.13e-5" } }));
    expect(r?.fxRate).toBe("16313.213703099511");
    expect(r?.amountHomeMinor).toBe(16313214);
    const tiny = convertToHome(100, "USD", "IDR", "2026-11-01", cache({ "2026-11-01": { usd: "5E-5" } }));
    expect(tiny?.fxRate).toBe("20000");
    expect(String(1e-7)).toBe("1e-7");
    const t2 = convertToHome(100, "USD", "IDR", "2026-11-01", cache({ "2026-11-01": { usd: String(1e-7) } }));
    expect(t2?.fxRate).toBe("10000000");
  });

  it("converts JPY (0 decimals) to IDR", () => {
    // 1 IDR = 0.01 JPY -> 1 JPY = 100 IDR; 500 JPY -> 50000 IDR -> 5,000,000 minor
    const r = convertToHome(500, "JPY", "IDR", "2026-11-01", cache({ "2026-11-01": { jpy: "0.01" } }));
    expect(r).toMatchObject({ amountHomeMinor: 5000000, fxRate: "100" });
  });

  it("converts to a 0-decimal home currency", () => {
    // home JPY, 1 JPY = 0.0065 USD -> 1 USD = 153.846153846154 JPY; USD 10.00 -> 1538 JPY
    const r = convertToHome(1000, "USD", "JPY", "2026-11-01", cache({ "2026-11-01": { usd: "0.0065" } }, "jpy"));
    expect(r?.amountHomeMinor).toBe(1538);
    expect(r?.fxRate).toBe("153.846153846154");
  });

  it("rounds half away from zero, including negatives", () => {
    const c = cache({ "2026-11-01": { usd: "2" } }); // 1 USD = 0.5 IDR = 50 minor
    expect(convertToHome(100, "USD", "IDR", "2026-11-01", c)?.amountHomeMinor).toBe(50);
    expect(convertToHome(300, "EUR", "JPY", "2026-11-01", cache({ "2026-11-01": { eur: "2" } }, "jpy"))?.amountHomeMinor).toBe(2); // EUR 3.00 / 2 per JPY = 1.5 -> 2
    expect(convertToHome(-300, "EUR", "JPY", "2026-11-01", cache({ "2026-11-01": { eur: "2" } }, "jpy"))?.amountHomeMinor).toBe(-2);
  });

  it("uses nearest earlier date and flags approximate", () => {
    const c = cache({ "2026-10-20": { usd: "0.00004" }, "2026-10-28": { usd: "0.00005" }, "2026-11-04": { usd: "0.00006" } });
    const r = convertToHome(100, "USD", "IDR", "2026-11-01", c);
    expect(r).toMatchObject({ fxRateDate: "2026-10-28", approximate: true, fxRate: "20000" });
  });

  it("returns null when only later dates exist", () => {
    expect(convertToHome(100, "USD", "IDR", "2026-10-01", cache({ "2026-11-04": { usd: "0.00006" } }))).toBeNull();
  });

  it("skips earlier dates that lack the currency", () => {
    const c = cache({ "2026-10-20": { usd: "0.00004" }, "2026-10-28": { eur: "1" } });
    expect(convertToHome(100, "USD", "IDR", "2026-11-01", c)?.fxRateDate).toBe("2026-10-20");
  });
});
