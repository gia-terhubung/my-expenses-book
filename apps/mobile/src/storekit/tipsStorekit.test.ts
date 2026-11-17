import { readFileSync } from "fs";
import { join } from "path";

import { TIP_IDS } from "@/payments/types";

const file = JSON.parse(readFileSync(join(__dirname, "..", "..", "storekit", "Tips.storekit"), "utf8"));

describe("Tips.storekit (local simulator prices)", () => {
  it("defines exactly the three tip IDs the app asks for, as consumables", () => {
    const products = file.products as { productID: string; type: string }[];
    expect(products.map((p) => p.productID).sort()).toEqual([...TIP_IDS].sort());
    expect(products.every((p) => p.type === "Consumable")).toBe(true);
  });

  it("uses the Indonesian storefront so prices render as Rp (long-price check)", () => {
    expect(file.settings._storefront).toBe("IDN");
  });
});
