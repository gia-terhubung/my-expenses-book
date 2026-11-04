import en from "./locales/en.json";
import es from "./locales/es.json";
import id from "./locales/id.json";
import ptBR from "./locales/pt-BR.json";

function flatten(o: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object") Object.assign(out, flatten(v as Record<string, unknown>, key));
    else out[key] = String(v);
  }
  return out;
}

const CATEGORY_KEYS = [
  "food_drink", "transport", "lodging", "groceries", "shopping",
  "utilities", "health", "office", "entertainment", "other",
];

describe("locales", () => {
  const enFlat = flatten(en);
  it.each([["id", id], ["es", es], ["pt-BR", ptBR]])("%s has exactly the en key set", (_n, l) => {
    expect(Object.keys(flatten(l)).sort()).toEqual(Object.keys(enFlat).sort());
  });
  it.each([["en", en], ["id", id], ["es", es], ["pt-BR", ptBR]])("%s has no empty strings", (_n, l) => {
    for (const v of Object.values(flatten(l))) expect(v.trim()).not.toBe("");
  });
  it("covers the default categories and required namespaces", () => {
    for (const k of CATEGORY_KEYS) expect(enFlat[`categories.${k}`]).toBeDefined();
    for (const ns of ["common", "tabs", "onboarding", "lock", "settings", "dbError"]) {
      expect(Object.keys(enFlat).some((k) => k.startsWith(`${ns}.`))).toBe(true);
    }
  });
  it("keeps interpolation placeholders consistent", () => {
    const ph = (s: string) => (s.match(/\{\{\w+\}\}/g) ?? []).sort().join();
    for (const l of [id, es, ptBR]) {
      const f = flatten(l);
      for (const [k, v] of Object.entries(enFlat)) expect(ph(f[k])).toBe(ph(v));
    }
  });
});
