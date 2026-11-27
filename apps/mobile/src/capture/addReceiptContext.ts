import { createContext, useContext } from "react";

import type { CaptureChoice } from "./CaptureSheet";

/**
 * The add-receipt flow's context, apart from its provider: headers and the + read it on every
 * screen, and importing the provider would load the whole capture pipeline with them.
 */
export type AddReceipt = { open(): void; start(mode: CaptureChoice): Promise<void> };

export const AddReceiptContext = createContext<AddReceipt | null>(null);

export function useAddReceiptContext(): AddReceipt {
  const ctx = useContext(AddReceiptContext);
  if (!ctx) throw new Error("useAddReceiptContext must be used inside AddReceiptProvider");
  return ctx;
}

/** The add flow if this screen is inside the tabs, else null (pages outside the tabs have no +). */
export function useMaybeAddReceiptContext(): AddReceipt | null {
  return useContext(AddReceiptContext);
}
