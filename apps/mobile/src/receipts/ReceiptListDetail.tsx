import { router, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import { useCallback } from "react";
import { BackHandler } from "react-native";

import type { ReceiptFilter } from "@/db/repositories/receiptQueries";
import { TwoPane } from "@/layout/TwoPane";
import { useWindowClass } from "@/layout/useWindowClass";
import { StatusBarInset } from "@/layout/StatusBarInset";

import { ReceiptDetail } from "./ReceiptDetail";
import { ReceiptList } from "./ReceiptList";

type Props = {
  filter: ReceiptFilter;
  ListHeaderComponent?: React.ReactElement | null;
  empty: React.ReactElement;
  /** Colour of the strip behind the status bar above the list pane (Home: the slip green). */
  topInsetColor?: string;
};

const openEdit = (id: string) => router.push({ pathname: "/edit/[id]", params: { id } } as unknown as Href);

/**
 * Shared list screen body: receipt list plus detail. Compact pushes /document/[id]; medium and
 * expanded show the detail beside the list. The selection lives in the `selected` route param, so
 * folding to compact keeps the open receipt (with a back control) and unfolding keeps the row
 * selected.
 */
export function ReceiptListDetail({ filter, ListHeaderComponent, empty, topInsetColor }: Props) {
  const windowClass = useWindowClass();
  const compact = windowClass === "compact";
  const { selected } = useLocalSearchParams<{ selected?: string }>();
  const clear = useCallback(() => router.setParams({ selected: undefined }), []);

  // Focus-scoped: a background tab or a screen under a pushed one must not swallow back.
  useFocusEffect(
    useCallback(() => {
      if (!compact || !selected) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        clear();
        return true;
      });
      return () => sub.remove();
    }, [compact, selected, clear]),
  );

  const onSelect = useCallback(
    (id: string) => {
      if (compact) router.push({ pathname: "/document/[id]", params: { id } } as unknown as Href);
      else router.setParams({ selected: id });
    },
    [compact],
  );

  return (
    <TwoPane
      primary={
        <StatusBarInset color={topInsetColor}>
          <ReceiptList
            filter={filter}
            selectedId={selected ?? null}
            onSelect={onSelect}
            ListHeaderComponent={ListHeaderComponent}
            empty={empty}
          />
        </StatusBarInset>
      }
      secondary={
        selected ? (
          // This screen has no header, so the pane takes the status-bar inset itself.
          <StatusBarInset>
            <ReceiptDetail id={selected} onEdit={openEdit} onDeleted={clear} onBack={compact ? clear : undefined} />
          </StatusBarInset>
        ) : null
      }
    />
  );
}
