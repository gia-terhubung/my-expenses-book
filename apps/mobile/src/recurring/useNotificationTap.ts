import { and, eq, isNull } from "drizzle-orm";
import * as Notifications from "expo-notifications";
import { router, type Href } from "expo-router";
import { useEffect, useRef } from "react";

import { openReview } from "@/capture/useAddReceipt";
import { useDb } from "@/db/DatabaseProvider";
import { receipts } from "@/db/schema";
import { logError } from "@/errorLog/instance";
import { useAppObscured } from "@/lock/appObscured";

/**
 * Opens the receipt a due-day notification is about. The response (live tap or the one that
 * launched the app) waits while the app is locked or covered; then `runNow` makes sure the day's
 * occurrence exists, and the draft for (ruleId, date) opens in review. Nothing found: nothing opens.
 */
export function useNotificationTap(runNow: () => void): void {
  const db = useDb();
  const obscured = useAppObscured();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<unknown>(null);

  useEffect(() => {
    if (obscured || !response || handled.current === response) return;
    handled.current = response;
    const data = response.notification.request.content.data as { tag?: string; ruleId?: string; date?: string } | null;
    if (data?.tag !== "recurring" || !data.ruleId || !data.date) return;
    try {
      runNow();
      const row = db
        .select({ id: receipts.id, status: receipts.status })
        .from(receipts)
        .where(and(eq(receipts.recurringRuleId, data.ruleId), eq(receipts.recurringDate, data.date), isNull(receipts.deletedAt)))
        .get();
      if (!row) return;
      if (row.status === "draft") openReview([row.id]);
      else router.push({ pathname: "/document/[id]", params: { id: row.id, from: "list" } } as unknown as Href);
    } catch (e) {
      logError("recurring", e);
    }
  }, [obscured, response, db, runNow]);
}
