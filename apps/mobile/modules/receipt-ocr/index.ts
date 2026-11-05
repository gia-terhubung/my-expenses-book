// Re-export the native module. On web, it will be resolved to ReceiptOcrModule.web.ts
// and on native platforms to ReceiptOcrModule.ts
import ReceiptOcrModule from './src/ReceiptOcrModule';

export { default } from './src/ReceiptOcrModule';
export * from './src/ReceiptOcr.types';

/** Rejects with code `ERR_OCR`. */
export function recognizeText(uri: string, languages: string[]) {
  return ReceiptOcrModule.recognizeText(uri, languages);
}

/** 64-bit dHash, 16 lowercase hex chars. Rejects with code `ERR_OCR`. */
export function imageHash(uri: string) {
  return ReceiptOcrModule.imageHash(uri);
}
