import { createCaptureLease, type CaptureLease } from "@/images/captureLease";

/**
 * "Restore in progress" lease, held by BackupScreen for the whole importBackup call. Capture
 * refuses to start while it is held: the restore's post-commit cleanupOrphanPages deletes every
 * page file the DB doesn't list, which would include a capture's not-yet-saved pages.
 * (Same counting lease as captureLease; the reverse guard is captureLease checked by restore.)
 */
export const restoreLease: CaptureLease = createCaptureLease();
