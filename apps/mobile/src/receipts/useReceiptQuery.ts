import { useCallback, useMemo, useState } from "react";

import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import {
  listReceipts,
  monthTotals,
  sumHome,
  type ReceiptFilter,
} from "@/db/repositories/receiptQueries";
import type { Receipt } from "@/db/types";
import { usePref } from "@/prefs/PrefsProvider";

export const PAGE_SIZE = 50;

/** Paged receipts plus totals. `filter` must be memoised by the caller. */
export function useReceiptQuery(filter: ReceiptFilter) {
  const db = useDb();
  const home = usePref("homeCurrency") ?? "USD";
  const version = useDataVersion();
  const key = JSON.stringify(filter);

  // First page and totals are re-read whenever the filter, the data or the home currency change.
  const snapshot = useMemo(() => {
    const f = JSON.parse(key) as ReceiptFilter;
    return {
      first: listReceipts(db, f, { limit: PAGE_SIZE }),
      total: sumHome(db, f, home),
      months: monthTotals(db, f, home),
    };
    // version: re-read after any write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, key, version, home]);

  // Later pages belong to one snapshot; a new snapshot drops them.
  const [extra, setExtra] = useState<{
    of: unknown;
    rows: Receipt[];
    done: boolean;
  } | null>(null);
  const more = extra && extra.of === snapshot ? extra : null;
  const rows = useMemo(
    () => (more ? [...snapshot.first, ...more.rows] : snapshot.first),
    [snapshot, more],
  );
  const hasMore = more ? !more.done : snapshot.first.length === PAGE_SIZE;

  const loadMore = useCallback(() => {
    if (!hasMore || rows.length === 0) return;
    const last = rows[rows.length - 1];
    const next = listReceipts(db, JSON.parse(key) as ReceiptFilter, {
      limit: PAGE_SIZE,
      after: { purchasedAtLocal: last.purchasedAtLocal, id: last.id },
    });
    setExtra({
      of: snapshot,
      rows: [...(more?.rows ?? []), ...next],
      done: next.length < PAGE_SIZE,
    });
  }, [db, key, hasMore, rows, snapshot, more]);

  return {
    rows,
    total: snapshot.total,
    months: snapshot.months,
    loadMore,
    hasMore,
  };
}
