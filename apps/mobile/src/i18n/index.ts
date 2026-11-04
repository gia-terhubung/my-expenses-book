import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";

import type { Language } from "@/prefs/prefs";

import en from "./locales/en.json";
import es from "./locales/es.json";
import id from "./locales/id.json";
import ptBR from "./locales/pt-BR.json";

export const i18n = createInstance();

export function initI18n(lang: Language): void {
  void i18n.use(initReactI18next).init({
    lng: lang,
    fallbackLng: "en",
    resources: {
      en: { translation: en },
      id: { translation: id },
      es: { translation: es },
      "pt-BR": { translation: ptBR },
    },
    interpolation: { escapeValue: false }, // React escapes
    initAsync: false, // bundled resources: ready synchronously
    returnNull: false,
  });
}

export function setLanguage(lang: Language): void {
  void i18n.changeLanguage(lang);
}
