import { NativeModule, requireNativeModule } from 'expo';

import type { OcrResult } from './ReceiptOcr.types';

declare class ReceiptOcrModule extends NativeModule<{}> {
  /** Rejects with code `ERR_OCR`. `languages` are Vision/BCP-47 codes, e.g. ["id-ID","en-US"] (ignored on Android: bundled Latin model). */
  recognizeText(uri: string, languages: string[]): Promise<OcrResult>;
  /** 64-bit dHash as 16 lowercase hex chars. Rejects with code `ERR_OCR`. */
  imageHash(uri: string): Promise<string>;
}

export default requireNativeModule<ReceiptOcrModule>('ReceiptOcr');
