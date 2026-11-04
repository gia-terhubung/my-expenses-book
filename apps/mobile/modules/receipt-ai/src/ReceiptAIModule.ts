import { NativeModule, requireNativeModule } from 'expo';

import type { ParseHints, ReceiptAIAvailability } from './ReceiptAI.types';

declare class ReceiptAIModule extends NativeModule<{}> {
  getAvailability(): Promise<ReceiptAIAvailability>;
  /** Returns a JSON string; validate in JS before use. */
  parseReceipt(ocrText: string, hints: ParseHints): Promise<string>;
}

export default requireNativeModule<ReceiptAIModule>('ReceiptAI');
