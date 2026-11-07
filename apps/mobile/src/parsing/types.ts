import type { ParseSource } from "@/db/schema";

export type FieldConfidence = {
  merchant: number;
  date: number;
  total: number;
  tax: number;
  currency: number;
  category: number;
};

export type ParsedReceipt = {
  merchant: string | null;
  /** YYYY-MM-DD */
  purchasedDate: string | null;
  /** HH:MM (24h) */
  purchasedTime: string | null;
  currency: string;
  totalMinor: number | null;
  taxMinor: number | null;
  categoryId: string | null;
  refNo: string | null;
  confidence: FieldConfidence;
  source: ParseSource;
};
