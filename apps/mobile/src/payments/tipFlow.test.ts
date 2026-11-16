import { handlePurchase, mapPurchaseError } from "./tipFlow";
import { TIP_IDS } from "./types";

describe("TIP_IDS", () => {
  it("lists the three spec consumables in display order", () => {
    expect(TIP_IDS).toEqual(["tip_coffee_small", "tip_coffee_standard", "tip_coffee_generous"]);
  });
});

describe("handlePurchase", () => {
  it("finishes a known tip as a consumable and thanks once", async () => {
    const finish = jest.fn().mockResolvedValue(undefined);
    const e = await handlePurchase({ productId: "tip_coffee_standard" }, finish);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledWith(true);
    expect(e).toEqual({ kind: "thanks", id: "tip_coffee_standard" });
  });

  it("finishes an unknown product so it never replays, without thanks", async () => {
    const finish = jest.fn().mockResolvedValue(undefined);
    await expect(handlePurchase({ productId: "unknown_sku" }, finish)).resolves.toBeNull();
    expect(finish).toHaveBeenCalledWith(true);
  });

  it("rejects instead of thanking when finishing fails", async () => {
    const finish = jest.fn().mockRejectedValue(new Error("store down"));
    await expect(handlePurchase({ productId: "tip_coffee_small" }, finish)).rejects.toThrow("store down");
  });
});

describe("mapPurchaseError", () => {
  it("maps the user-cancelled code to cancelled", () => {
    expect(mapPurchaseError({ code: "user-cancelled" })).toEqual({ kind: "cancelled" });
  });
  it("keeps other codes as failed", () => {
    expect(mapPurchaseError({ code: "E_NETWORK" })).toEqual({ kind: "failed", code: "E_NETWORK" });
  });
  it("uses unknown when no code is given", () => {
    expect(mapPurchaseError({})).toEqual({ kind: "failed", code: "unknown" });
  });
});
