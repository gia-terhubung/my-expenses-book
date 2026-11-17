import { createContext, useContext, type ReactNode } from "react";

import type { CaptureChoice } from "./CaptureSheet";
import { useAddReceipt } from "./useAddReceipt";

export type AddReceipt = { open(): void; start(mode: CaptureChoice): Promise<void> };

const AddReceiptContext = createContext<AddReceipt | null>(null);

/**
 * One add-receipt flow and one sheet for the whole tabs navigator. The sheet lives above the bar
 * and the rail, so fold/unfold (bar <-> rail) never unmounts it while it is open.
 */
export function AddReceiptProvider({ children }: { children: ReactNode }) {
  const add = useAddReceipt();
  return (
    <AddReceiptContext.Provider value={{ open: add.open, start: add.start }}>
      {children}
      {add.sheet}
    </AddReceiptContext.Provider>
  );
}

export function useAddReceiptContext(): AddReceipt {
  const ctx = useContext(AddReceiptContext);
  if (!ctx) throw new Error("useAddReceiptContext must be used inside AddReceiptProvider");
  return ctx;
}
