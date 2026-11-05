/**
 * "Capture in progress" lease (Ruling I). While held, the background purge keeps cache/work/
 * and cache/ImageManipulator/ (the pipeline's in-flight plaintext) and clears only the view
 * cache: Android picker/scanner activities background the app mid-capture.
 */
export interface CaptureLease {
  /** Returns the release function (idempotent). */
  acquire(): () => void;
  held(): boolean;
  /** Called each time the last holder releases. */
  onFree(cb: () => void): () => void;
}

export function createCaptureLease(): CaptureLease {
  let count = 0;
  const listeners = new Set<() => void>();
  return {
    acquire() {
      count++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        count--;
        if (count === 0) listeners.forEach((cb) => cb());
      };
    },
    held: () => count > 0,
    onFree(cb) {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
  };
}

/** App-wide lease shared by the capture route and ImageStoreProvider. */
export const captureLease = createCaptureLease();
