import { useCallback, useMemo, useState } from "react";

import { useDb } from "@/db/DatabaseProvider";
import { useDataVersion } from "@/db/changes";
import {
  listReceipts,
  monthTotals,
  type ReceiptFilter,
} from "@/db/repositories/receiptQueries";
import { usePref } from "@/prefs/PrefsProvider";

export const PAGE_SIZE = 50;

/** Paged receipts plus per-month totals. `filter` must be memoised by the caller. */
export function useReceiptQuery(filter: ReceiptFilter) {
  const db = useDb();
  const home = usePref("homeCurrency") ?? "USD";
  const version = useDataVersion();
  const key = JSON.stringify(filter);

  // Rows wanted for this filter. A data change refetches the same window (scroll position
  // survives); a different filter starts again at one page.
  const [requested, setRequested] = useState({ key, count: PAGE_SIZE });
  const count = requested.key === key ? requested.count : PAGE_SIZE;

  const rows = useMemo(
    () => listReceipts(db, JSON.parse(key) as ReceiptFilter, { limit: count }),
    // version: re-read after any write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, key, version, count],
  );
  const months = useMemo(
    () => monthTotals(db, JSON.parse(key) as ReceiptFilter, home),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, key, version, home],
  );

  const hasMore = rows.length >= count;
  const loadMore = useCallback(() => {
    if (hasMore) setRequested({ key, count: count + PAGE_SIZE });
  }, [hasMore, key, count]);

  return { rows, months, loadMore, hasMore };
}
