import type { WindowClass } from "@/layout/windowClass";

/** The add button hides while a compact screen shows the detail pane over the list. */
export function feedFabVisible(windowClass: WindowClass, selected: string | undefined): boolean {
  return !(windowClass === "compact" && !!selected);
}
