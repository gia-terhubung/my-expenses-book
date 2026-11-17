import en from "@/i18n/locales/en.json";
import es from "@/i18n/locales/es.json";
import id from "@/i18n/locales/id.json";
import ptBR from "@/i18n/locales/pt-BR.json";

const ALL = { en, id, es, "pt-BR": ptBR };

describe("tip jar copy", () => {
  it.each(Object.entries(ALL))("%s: the small tier is Espresso", (_lang, l) => {
    expect(l.tips.small).toBe("Espresso");
  });

  it.each(Object.entries(ALL))("%s: has a heading, a line per tier and the optional note", (_lang, l) => {
    for (const k of ["heading", "smallNote", "standardNote", "generousNote", "optional"] as const) {
      expect(l.tips[k].length).toBeGreaterThan(0);
    }
  });

  it("id keeps Kopi and Kopi istimewa", () => {
    expect([id.tips.standard, id.tips.generous]).toEqual(["Kopi", "Kopi istimewa"]);
  });
});
