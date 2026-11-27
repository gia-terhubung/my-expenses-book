import type { SearchState } from "./filterState";

/**
 * Hands the committed filters and the apply step from Search to the native filter sheet
 * route (iOS). In memory; set right before opening the sheet.
 */
type Pending = { value: SearchState; onApply(next: SearchState): void };
let pending: Pending | null = null;

export const setFilterRequest = (p: Pending) => {
  pending = p;
};
export const getFilterRequest = () => pending;
