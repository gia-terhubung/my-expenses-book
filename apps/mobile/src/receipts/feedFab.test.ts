import { feedFabVisible } from "./feedFab";

describe("feedFabVisible", () => {
  it("hides only when compact with a selected receipt", () => {
    expect(feedFabVisible("compact", "r1")).toBe(false);
    expect(feedFabVisible("compact", undefined)).toBe(true);
    expect(feedFabVisible("compact", "")).toBe(true);
    expect(feedFabVisible("medium", "r1")).toBe(true);
    expect(feedFabVisible("expanded", "r1")).toBe(true);
  });
});
