import { deviceTimeZone, formatLocal, localToUtc } from "@/capture/localTime";
import { createReceipt } from "@/db/repositories/receipts";
import type { AppDb } from "@/db/types";

/**
 * "Add manually": an empty draft with no photo, in the home currency, dated now. Total 0 with no
 * parse confidence = unknown (Ruling X); no confidence means no "Check this" hints.
 */
export function createManualDraft(db: AppDb, opts: { home: string; now?: Date; timeZone?: string }): string {
  const now = opts.now ?? new Date();
  const tz = opts.timeZone ?? deviceTimeZone();
  const local = formatLocal(now, tz);
  return createReceipt(db, {
    status: "draft",
    merchant: null,
    purchasedAtLocal: local,
    purchasedTz: tz,
    purchasedAtUtc: localToUtc(local, tz),
    scannedAtUtc: now.getTime(),
    scannedTz: tz,
    currency: opts.home,
    totalMinor: 0,
    homeCurrencyAtSave: opts.home,
    parseSource: "manual",
    parseConfidence: null,
  }).id;
}
