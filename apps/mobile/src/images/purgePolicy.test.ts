import { shouldPurgeOnAppState } from "./purgePolicy";

describe("shouldPurgeOnAppState", () => {
  it("purges only on background", () => {
    expect(shouldPurgeOnAppState("background")).toBe(true);
    expect(shouldPurgeOnAppState("inactive")).toBe(false);
    expect(shouldPurgeOnAppState("active")).toBe(false);
  });
});
