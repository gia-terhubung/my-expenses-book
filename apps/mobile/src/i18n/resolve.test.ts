import { defaultTaxYearStartMonth, resolveHomeCurrency, resolveLanguage } from "./resolve";

const loc = (languageTag: string, languageCode: string | null) => ({ languageTag, languageCode });

describe("resolveLanguage", () => {
  it("falls back to en for unsupported or empty", () => {
    expect(resolveLanguage([loc("fr-FR", "fr")])).toBe("en");
    expect(resolveLanguage([])).toBe("en");
  });
  it("maps regional variants", () => {
    expect(resolveLanguage([loc("pt-PT", "pt")])).toBe("pt-BR");
    expect(resolveLanguage([loc("pt-BR", "pt")])).toBe("pt-BR");
    expect(resolveLanguage([loc("id-ID", "id")])).toBe("id");
    expect(resolveLanguage([loc("in-ID", "in")])).toBe("id");
    expect(resolveLanguage([loc("es-MX", "es")])).toBe("es");
    expect(resolveLanguage([loc("en-GB", "en")])).toBe("en");
  });
  it("handles locale without region or with null languageCode", () => {
    expect(resolveLanguage([loc("es", "es")])).toBe("es");
    expect(resolveLanguage([loc("pt", null)])).toBe("pt-BR");
  });
  it("uses the first supported locale in preference order", () => {
    expect(resolveLanguage([loc("fr-FR", "fr"), loc("es-ES", "es"), loc("id-ID", "id")])).toBe("es");
  });
});

describe("resolveHomeCurrency", () => {
  it("defaults to USD", () => {
    expect(resolveHomeCurrency([{ currencyCode: null }])).toBe("USD");
    expect(resolveHomeCurrency([])).toBe("USD");
  });
  it("uses first valid ISO code", () => {
    expect(resolveHomeCurrency([{ currencyCode: "IDR" }])).toBe("IDR");
    expect(resolveHomeCurrency([{ currencyCode: "ZZZ" }, { currencyCode: "BRL" }])).toBe("BRL");
  });
  it("rejects unknown codes", () => {
    expect(resolveHomeCurrency([{ currencyCode: "ZZZ" }])).toBe("USD");
  });
});

describe("defaultTaxYearStartMonth", () => {
  it("returns region start months", () => {
    expect(defaultTaxYearStartMonth("GB")).toBe(4);
    expect(defaultTaxYearStartMonth("AU")).toBe(7);
    expect(defaultTaxYearStartMonth("NZ")).toBe(4);
    expect(defaultTaxYearStartMonth("IN")).toBe(4);
    expect(defaultTaxYearStartMonth("ID")).toBe(1);
    expect(defaultTaxYearStartMonth(null)).toBe(1);
  });
});
