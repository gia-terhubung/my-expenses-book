import type { ReactNode } from "react";

import { AddReceiptContext } from "./addReceiptContext";
import { useAddReceipt } from "./useAddReceipt";

export {
  useAddReceiptContext,
  useMaybeAddReceiptContext,
  type AddReceipt,
} from "./addReceiptContext";

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
