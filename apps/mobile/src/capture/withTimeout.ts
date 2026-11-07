/** A bounded step gave up waiting (the underlying native call may still be running). */
export class StepTimeoutError extends Error {
  constructor(ms: number) {
    super(`step timed out after ${ms} ms`);
    this.name = "StepTimeoutError";
  }
}

/** The step was abandoned because its AbortSignal fired (user cancelled). */
export class StepAbortedError extends Error {
  constructor() {
    super("step aborted");
    this.name = "StepAbortedError";
  }
}

/** Per-call bound for native OCR / dHash / savePage (resize + encrypt) during capture. */
export const CAPTURE_STEP_TIMEOUT_MS = 20_000;

/**
 * Settles with `task`, or rejects with StepTimeoutError after `ms`, or with StepAbortedError as
 * soon as `signal` aborts (immediately when it already has). Native calls cannot be cancelled, so
 * a value that arrives after we gave up is handed to `onLate`, letting the caller clean up what
 * it produced (e.g. delete a plaintext file). Late rejections are swallowed.
 */
export function withTimeout<T>(
  task: Promise<T>,
  ms: number,
  opts: { signal?: AbortSignal; onLate?: (value: T) => void } = {},
): Promise<T> {
  const { signal, onLate } = opts;
  let abandoned = false;
  task.then(
    (v) => {
      if (abandoned) onLate?.(v);
    },
    () => undefined,
  );
  if (signal?.aborted) {
    abandoned = true;
    return Promise.reject(new StepAbortedError());
  }
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const giveUp = (e: Error) => {
      if (settled) return;
      abandoned = true;
      finish();
      reject(e);
    };
    const onAbort = () => giveUp(new StepAbortedError());
    const timer = setTimeout(() => giveUp(new StepTimeoutError(ms)), ms);
    signal?.addEventListener("abort", onAbort);
    task.then(
      (v) => {
        if (settled) return;
        finish();
        resolve(v);
      },
      (e: unknown) => {
        if (settled) return;
        finish();
        reject(e);
      },
    );
  });
}
