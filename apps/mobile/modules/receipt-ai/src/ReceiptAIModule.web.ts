import { registerWebModule, NativeModule } from 'expo';

import type { ParseHints, ReceiptAIAvailability } from './ReceiptAI.types';

// No on-device LLM on web.
class ReceiptAIModule extends NativeModule<{}> {
  async getAvailability(): Promise<ReceiptAIAvailability> {
    return { available: false, engine: null, reason: 'platform' };
  }
  async parseReceipt(_ocrText: string, _hints: ParseHints): Promise<string> {
    throw new Error('On-device model unavailable: platform');
  }
}

export default registerWebModule(ReceiptAIModule, 'ReceiptAIModule');
