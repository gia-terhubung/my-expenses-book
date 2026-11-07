import { restoreLease } from "@/backup/restoreLease";
import type { CaptureLease } from "@/images/captureLease";

/**
 * Capture must not start while a backup restore runs: the restore's post-commit cleanup deletes
 * every page file the DB doesn't list, including a capture's not-yet-saved pages. Returns false
 * (after telling the user) when blocked.
 */
export function mayStartCapture(tell: (key: "capture.restoreRunning") => void, lease: CaptureLease = restoreLease): boolean {
  if (!lease.held()) return true;
  tell("capture.restoreRunning");
  return false;
}
