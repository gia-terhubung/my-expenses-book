import type { OcrObservation } from "../../modules/receipt-ocr";
import { toLines } from "./readingOrder";

function obs(text: string, x: number, y: number, w = 0.2, h = 0.03): OcrObservation {
  return { text, box: { x, y, w, h }, confidence: 1 };
}

describe("toLines", () => {
  it("merges same-row boxes left to right", () => {
    expect(toLines([obs("Rp41.000", 0.7, 0.505), obs("Total", 0.1, 0.5)])).toEqual(["Total  Rp41.000"]);
  });

  it("orders rows top to bottom", () => {
    expect(toLines([obs("Total  ", 0.1, 0.8), obs("Indomaret", 0.1, 0.1), obs("Kasir", 0.1, 0.4)])).toEqual([
      "Indomaret",
      "Kasir",
      "Total",
    ]);
  });

  it("keeps rows apart when centers differ by half a box height or more", () => {
    expect(toLines([obs("A", 0.1, 0.5), obs("B", 0.5, 0.516)])).toEqual(["A", "B"]);
  });

  it("drops empty observations and returns [] for none", () => {
    expect(toLines([])).toEqual([]);
    expect(toLines([obs("   ", 0.1, 0.1)])).toEqual([]);
  });
});
