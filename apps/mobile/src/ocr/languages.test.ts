import { OCR_LANGUAGES } from "./languages";

describe("OCR_LANGUAGES", () => {
  it("pins id-ID and en-US for en and id UI", () => {
    expect(OCR_LANGUAGES("en")).toEqual(["id-ID", "en-US"]);
    expect(OCR_LANGUAGES("id")).toEqual(["id-ID", "en-US"]);
  });

  it("adds the UI language's Vision code when different", () => {
    expect(OCR_LANGUAGES("es")).toEqual(["id-ID", "en-US", "es-ES"]);
    expect(OCR_LANGUAGES("pt-BR")).toEqual(["id-ID", "en-US", "pt-BR"]);
  });
});
