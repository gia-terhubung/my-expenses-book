import { compactAmount } from "./compactAmount";

describe("compactAmount", () => {
  it("IDR 31,3 jt in id", () => {
    expect(compactAmount(3_130_000_000, "IDR", "id")).toContain("31,3");
  });

  it("JPY 1.2M in en", () => {
    expect(compactAmount(1_234_567, "JPY", "en")).toContain("1.2");
  });

  it("IDR 10^14 minor stays at most 12 chars", () => {
    expect(compactAmount(10 ** 14, "IDR", "id").length).toBeLessThanOrEqual(12);
  });

  it("falls back to the hand-rolled form when Intl.NumberFormat throws on notation", () => {
    const Real = Intl.NumberFormat;
    const spy = jest.spyOn(Intl, "NumberFormat").mockImplementation(((locale: string, opts?: Intl.NumberFormatOptions) => {
      if (opts?.notation) throw new RangeError("notation unsupported");
      return new Real(locale, opts);
    }) as unknown as typeof Intl.NumberFormat);
    try {
      // A fresh module: the formatter cache must not hold compact formatters built above.
      jest.isolateModules(() => {
        const { compactAmount: fresh } = jest.requireActual<typeof import("./compactAmount")>("./compactAmount");
        expect(fresh(3_130_000_000, "IDR", "id")).toBe("Rp 31,3 jt");
        expect(fresh(1_234_567, "JPY", "en")).toBe("¥ 1.2 M");
        expect(fresh(310_000_000, "BRL", "pt-BR")).toBe("R$ 3,1 mi");
        expect(fresh(1_200_000, "EUR", "es")).toBe("€ 12 mil");
        expect(fresh(99_900, "USD", "en")).toBe("$999.00");
      });
      expect(spy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ notation: "compact" }));
    } finally {
      spy.mockRestore();
    }
  });
});
