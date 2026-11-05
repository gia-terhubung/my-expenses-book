import { CodedError, registerWebModule, NativeModule } from 'expo';

import type { OcrResult } from './ReceiptOcr.types';

// No on-device OCR on web: callers fall back to manual entry.
class ReceiptOcrModule extends NativeModule<{}> {
  async recognizeText(_uri: string, _languages: string[]): Promise<OcrResult> {
    throw new CodedError('ERR_OCR', 'OCR unavailable: platform');
  }
  async imageHash(_uri: string): Promise<string> {
    throw new CodedError('ERR_OCR', 'Image hash unavailable: platform');
  }
}

export default registerWebModule(ReceiptOcrModule, 'ReceiptOcrModule');
