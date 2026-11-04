// Re-export the native module. On web, it will be resolved to ReceiptAIModule.web.ts
// and on native platforms to ReceiptAIModule.ts
export { default } from './src/ReceiptAIModule';
export * from './src/ReceiptAI.types';
