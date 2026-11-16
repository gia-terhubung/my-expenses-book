import { feedFabVisible } from "./feedFab";

describe("feedFabVisible", () => {
  it("shows only on medium/expanded (compact adds from the floating tab bar's +)", () => {
    expect(feedFabVisible("compact", "r1")).toBe(false);
    expect(feedFabVisible("compact", undefined)).toBe(false);
    expect(feedFabVisible("compact", "")).toBe(false);
    expect(feedFabVisible("medium", undefined)).toBe(true);
    expect(feedFabVisible("medium", "r1")).toBe(true);
    expect(feedFabVisible("expanded", "r1")).toBe(true);
  });
});
