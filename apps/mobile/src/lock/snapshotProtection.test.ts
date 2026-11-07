import {
  applySnapshotProtection,
  type ScreenCaptureApi,
} from "./snapshotProtection";

function fake(): ScreenCaptureApi {
  return {
    enableAppSwitcherProtectionAsync: jest.fn().mockResolvedValue(undefined),
    disableAppSwitcherProtectionAsync: jest.fn().mockResolvedValue(undefined),
    preventScreenCaptureAsync: jest.fn().mockResolvedValue(undefined),
    allowScreenCaptureAsync: jest.fn().mockResolvedValue(undefined),
  };
}

describe("applySnapshotProtection", () => {
  it("enables app-switcher protection and screen-capture block when lock enabled", async () => {
    const sc = fake();
    await applySnapshotProtection(true, sc);
    expect(sc.enableAppSwitcherProtectionAsync).toHaveBeenCalledTimes(1);
    expect(sc.preventScreenCaptureAsync).toHaveBeenCalledTimes(1);
    expect(sc.disableAppSwitcherProtectionAsync).not.toHaveBeenCalled();
    expect(sc.allowScreenCaptureAsync).not.toHaveBeenCalled();
  });

  it("disables both when lock disabled", async () => {
    const sc = fake();
    await applySnapshotProtection(false, sc);
    expect(sc.disableAppSwitcherProtectionAsync).toHaveBeenCalledTimes(1);
    expect(sc.allowScreenCaptureAsync).toHaveBeenCalledTimes(1);
    expect(sc.enableAppSwitcherProtectionAsync).not.toHaveBeenCalled();
    expect(sc.preventScreenCaptureAsync).not.toHaveBeenCalled();
  });
});
