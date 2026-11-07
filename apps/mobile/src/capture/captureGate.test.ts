import { restoreLease } from "@/backup/restoreLease";
import { createCaptureLease } from "@/images/captureLease";

import { mayStartCapture } from "./captureGate";

describe("mayStartCapture", () => {
  it("refuses and tells the user while a restore holds the lease", () => {
    const lease = createCaptureLease();
    const tell = jest.fn();
    expect(mayStartCapture(tell, lease)).toBe(true);
    expect(tell).not.toHaveBeenCalled();
    const release = lease.acquire();
    expect(mayStartCapture(tell, lease)).toBe(false);
    expect(tell).toHaveBeenCalledWith("capture.restoreRunning");
    release();
    expect(mayStartCapture(tell, lease)).toBe(true);
  });

  it("uses the app-wide restore lease by default", () => {
    const tell = jest.fn();
    const release = restoreLease.acquire();
    expect(mayStartCapture(tell)).toBe(false);
    release();
    expect(mayStartCapture(tell)).toBe(true);
  });
});
