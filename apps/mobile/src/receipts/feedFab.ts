import type { WindowClass } from "@/layout/windowClass";

/**
 * Home's add FAB shows only on wide layouts (beside the side rail). Compact adds from the floating
 * tab bar's +, which every tab shares.
 */
export function feedFabVisible(windowClass: WindowClass, _selected: string | undefined): boolean {
  return windowClass !== "compact";
}
