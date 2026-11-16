import { handlePurchase, mapPurchaseError, recoverPurchases, settlePurchase } from "./tipFlow";
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

describe("pending and recovery (final review C2)", () => {
  it("does not finish or thank a pending purchase", async () => {
    const finish = jest.fn().mockResolvedValue(undefined);
    await expect(
      handlePurchase({ productId: "tip_coffee_small", purchaseState: "pending" }, finish),
    ).resolves.toEqual({ kind: "pending" });
    expect(finish).not.toHaveBeenCalled();
  });

  it("settlePurchase maps a finish failure to finishLater, never to failed (the store did charge)", async () => {
    const finish = jest.fn().mockRejectedValue(new Error("network"));
    await expect(settlePurchase({ productId: "tip_coffee_small", purchaseState: "purchased" }, finish)).resolves.toEqual({
      kind: "finishLater",
    });
  });

  it("recoverPurchases finishes every completed purchase, skips pending ones, emits each result", async () => {
    const finished: string[] = [];
    const events: unknown[] = [];
    await recoverPurchases(
      [
        { productId: "tip_coffee_small", purchaseState: "purchased" },
        { productId: "tip_coffee_generous", purchaseState: "pending" },
        { productId: "tip_coffee_standard", purchaseState: "purchased" },
      ],
      (p) => async () => void finished.push(p.productId),
      (e) => events.push(e),
    );
    expect(finished).toEqual(["tip_coffee_small", "tip_coffee_standard"]);
    expect(events).toEqual([
      { kind: "thanks", id: "tip_coffee_small" },
      { kind: "pending" },
      { kind: "thanks", id: "tip_coffee_standard" },
    ]);
  });
});
