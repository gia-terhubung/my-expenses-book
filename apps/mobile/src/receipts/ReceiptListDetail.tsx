import { router, useFocusEffect, useLocalSearchParams, type Href } from "expo-router";
import { useCallback } from "react";
import { BackHandler } from "react-native";

import type { ReceiptFilter } from "@/db/repositories/receiptQueries";
import { StatusBarInset } from "@/layout/StatusBarInset";
import { TwoPane } from "@/layout/TwoPane";
import { useLayout } from "@/layout/useLayout";

import { takePendingSelection } from "./pendingSelection";
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
 * Shared list screen body: receipt list plus detail. When not split a row pushes
 * /document/[id]; when split the detail shows beside the list. The selection lives in the
 * `selected` route param, so folding to a single pane keeps the open receipt (with a back control) and unfolding keeps the row
 * selected.
 */
export function ReceiptListDetail({ filter, ListHeaderComponent, empty, topInsetColor }: Props) {
  const { split } = useLayout();
  const { selected } = useLocalSearchParams<{ selected?: string }>();
  const clear = useCallback(() => router.setParams({ selected: undefined }), []);

  // Focus-scoped: a background tab or a screen under a pushed one must not swallow back.
  useFocusEffect(
    useCallback(() => {
      if (split || !selected) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        clear();
        return true;
      });
      return () => sub.remove();
    }, [split, selected, clear]),
  );

  // A receipt popped back from the pushed screen after an unfold becomes this screen's selection.
  // Whichever list gains focus next takes it; folded again before that, it shows in the single pane.
  useFocusEffect(
    useCallback(() => {
      const id = takePendingSelection();
      if (id) router.setParams({ selected: id });
    }, []),
  );

  const onSelect = useCallback(
    (id: string) => {
      if (!split) router.push({ pathname: "/document/[id]", params: { id, from: "list" } } as unknown as Href);
      else router.setParams({ selected: id });
    },
    [split],
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
            <ReceiptDetail id={selected} onEdit={openEdit} onDeleted={clear} onBack={!split ? clear : undefined} />
          </StatusBarInset>
        ) : null
      }
    />
  );
}
