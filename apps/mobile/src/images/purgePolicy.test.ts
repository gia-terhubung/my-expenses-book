import { purgeScopeOnAppState, shouldPurgeOnAppState } from "./purgePolicy";

describe("shouldPurgeOnAppState", () => {
  it("purges only on background", () => {
    expect(shouldPurgeOnAppState("background")).toBe(true);
    expect(shouldPurgeOnAppState("inactive")).toBe(false);
    expect(shouldPurgeOnAppState("active")).toBe(false);
  });
});

describe("purgeScopeOnAppState", () => {
  it("keeps capture work files while a capture is running", () => {
    expect(purgeScopeOnAppState("background", false)).toEqual({ keepCaptureWork: false });
    expect(purgeScopeOnAppState("background", true)).toEqual({ keepCaptureWork: true });
    expect(purgeScopeOnAppState("inactive", false)).toBeNull();
  });
});
