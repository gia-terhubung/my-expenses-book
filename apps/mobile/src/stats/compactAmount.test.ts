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
        // Rounding up to 1000 rolls over to the next band.
        expect(fresh(99_995_000, "IDR", "id")).toBe("Rp 1 jt");
      });
      expect(spy).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ notation: "compact" }));
    } finally {
      spy.mockRestore();
    }
  });

  it("falls back when Intl accepts compact notation but prints the full amount (Hermes)", () => {
    const Real = Intl.NumberFormat;
    const spy = jest.spyOn(Intl, "NumberFormat").mockImplementation(((locale: string, opts?: Intl.NumberFormatOptions) => {
      if (!opts?.notation) return new Real(locale, opts);
      const full = new Real(locale, { ...opts, notation: undefined });
      return {
        format: (n: number) => full.format(n),
        formatToParts: (n: number) => full.formatToParts(n),
        resolvedOptions: () => ({ ...full.resolvedOptions(), notation: opts.notation }),
      };
    }) as unknown as typeof Intl.NumberFormat);
    try {
      jest.isolateModules(() => {
        const { compactAmount: fresh } = jest.requireActual<typeof import("./compactAmount")>("./compactAmount");
        expect(fresh(1_205_389_900, "IDR", "id")).toBe("Rp 12,1 jt");
      });
    } finally {
      spy.mockRestore();
    }
  });
});

describe("currencySymbol without NumberFormat.formatToParts (iOS Hermes)", () => {
  const original = Intl.NumberFormat.prototype.formatToParts;
  beforeEach(() => {
    jest.resetModules();
    // @ts-expect-error simulate the runtime gap
    Intl.NumberFormat.prototype.formatToParts = undefined;
  });
  afterEach(() => {
    Intl.NumberFormat.prototype.formatToParts = original;
  });

  it.each([
    ["id-ID", "IDR", "Rp"],
    ["en-US", "USD", "$"],
    ["pt-BR", "BRL", "R$"],
    ["en-US", "EUR", "€"],
  ])("%s %s -> %s, no crash", (locale, currency, symbol) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { currencySymbol } = require("./compactAmount");
    expect(currencySymbol(locale, currency)).toBe(symbol);
  });
});
