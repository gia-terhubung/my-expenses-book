import { and, eq, isNull } from "drizzle-orm";
import * as Notifications from "expo-notifications";
import { router, type Href } from "expo-router";
import { useEffect, useState } from "react";

import { openReview } from "@/capture/useAddReceipt";
import { useDb } from "@/db/DatabaseProvider";
import { receipts } from "@/db/schema";
import { logError } from "@/errorLog/instance";
import { useAppObscured } from "@/lock/appObscured";

// Module-level, so a LockGate remount (unlock) never reopens a response already handled.
let handledKey: string | null = null;
const RETRY_MS = 500;
const MAX_RETRIES = 6;

const keyOf = (r: Notifications.NotificationResponse): string => `${r.notification.request.identifier}@${r.notification.date}`;

/**
 * Opens the receipt a due-day notification is about. The response (live tap or the one that
 * launched the app) waits while the app is locked or covered; then `runNow` makes sure the day's
 * occurrence exists, and the draft for (ruleId, date) opens in review. Nothing found: nothing opens.
 * A response counts as handled only once handled for good (opened, or nothing to open); a throw
 * (navigation not ready on cold start) retries shortly.
 */
export function useNotificationTap(runNow: () => void): void {
  const db = useDb();
  const obscured = useAppObscured();
  const response = Notifications.useLastNotificationResponse();
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (obscured || !response || handledKey === keyOf(response)) return;
    const key = keyOf(response);
    const data = response.notification.request.content.data as { tag?: string; ruleId?: string; date?: string } | null;
    if (data?.tag !== "recurring" || !data.ruleId || !data.date) {
      handledKey = key;
      return;
    }
    try {
      runNow();
      const row = db
        .select({ id: receipts.id, status: receipts.status })
        .from(receipts)
        .where(and(eq(receipts.recurringRuleId, data.ruleId), eq(receipts.recurringDate, data.date), isNull(receipts.deletedAt)))
        .get();
      if (row) {
        if (row.status === "draft") openReview([row.id]);
        else router.push({ pathname: "/document/[id]", params: { id: row.id, from: "list" } } as unknown as Href);
      }
      handledKey = key;
    } catch (e) {
      logError("recurring", e);
      if (attempts < MAX_RETRIES) {
        const timer = setTimeout(() => setAttempts((n) => n + 1), RETRY_MS);
        return () => clearTimeout(timer);
      }
      handledKey = key;
    }
  }, [obscured, response, db, runNow, attempts]);
}
