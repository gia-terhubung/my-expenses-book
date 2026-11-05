import type { Language } from "../prefs/prefs";

const BASE = ["id-ID", "en-US"];

/** Vision recognition-language code for each UI language. */
const VISION_CODE: Record<Language, string> = {
  en: "en-US",
  id: "id-ID",
  es: "es-ES",
  "pt-BR": "pt-BR",
};

/** Languages to pin for OCR (bake-off: never auto-detect). */
export function OCR_LANGUAGES(uiLanguage: Language): string[] {
  const ui = VISION_CODE[uiLanguage];
  return BASE.includes(ui) ? [...BASE] : [...BASE, ui];
}
