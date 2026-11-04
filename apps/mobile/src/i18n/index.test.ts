import { i18n, initI18n, setLanguage } from "./index";

describe("initI18n", () => {
  it("initialises synchronously in the requested language", () => {
    initI18n("es");
    expect(i18n.t("tabs.settings")).toBe("Ajustes");
    expect(i18n.t("dbError.resetWarning", { word: "RESET" })).toContain("RESET");
  });
  it("switches language and falls back to en for missing keys", () => {
    setLanguage("id");
    expect(i18n.t("categories.food_drink")).toBe("Makanan & Minuman");
    expect(i18n.t("does.not.exist", "x")).toBe("x");
    expect(i18n.t("settings.lockTimeoutMinutes", { count: 5, lng: "pt-BR" })).toBe("5 minutos");
  });
});
