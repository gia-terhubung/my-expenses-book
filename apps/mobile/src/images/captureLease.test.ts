import { createCaptureLease } from "./captureLease";

describe("capture lease", () => {
  it("is held until every holder releases, and release is idempotent", () => {
    const lease = createCaptureLease();
    const onFree = jest.fn();
    lease.onFree(onFree);
    expect(lease.held()).toBe(false);
    const a = lease.acquire();
    const b = lease.acquire();
    a();
    a();
    expect(lease.held()).toBe(true);
    expect(onFree).not.toHaveBeenCalled();
    b();
    expect(lease.held()).toBe(false);
    expect(onFree).toHaveBeenCalledTimes(1);
  });
});
