export type ReceiptAIEngine = 'apple_fm' | 'gemini_nano';

export type ReceiptAIAvailability = {
  available: boolean;
  engine: ReceiptAIEngine | null;
  reason?: string;
};

export type ParseHints = { locale: string; homeCurrency: string };
