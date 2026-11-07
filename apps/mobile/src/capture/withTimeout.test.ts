import { StepAbortedError, StepTimeoutError, withTimeout } from "./withTimeout";

const never = <T,>() => new Promise<T>(() => undefined);
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("withTimeout", () => {
  it("passes through a value or error that arrives in time", async () => {
    await expect(withTimeout(Promise.resolve(7), 50)).resolves.toBe(7);
    await expect(withTimeout(Promise.reject(new Error("boom")), 50)).rejects.toThrow("boom");
  });

  it("rejects with StepTimeoutError when the task hangs", async () => {
    await expect(withTimeout(never(), 10)).rejects.toBeInstanceOf(StepTimeoutError);
  });

  it("rejects at once when the signal aborts (or already aborted)", async () => {
    const ctrl = new AbortController();
    const p = withTimeout(never(), 10_000, { signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toBeInstanceOf(StepAbortedError);
    await expect(withTimeout(never(), 10_000, { signal: ctrl.signal })).rejects.toBeInstanceOf(StepAbortedError);
  });

  it("hands a late value to onLate, and never calls onLate for an in-time value", async () => {
    const onLate = jest.fn();
    await withTimeout(Promise.resolve("ok"), 50, { onLate });
    expect(onLate).not.toHaveBeenCalled();
    const d = deferred<string>();
    await expect(withTimeout(d.promise, 5, { onLate })).rejects.toBeInstanceOf(StepTimeoutError);
    d.resolve("late");
    await d.promise;
    await Promise.resolve();
    expect(onLate).toHaveBeenCalledWith("late");
  });
});
