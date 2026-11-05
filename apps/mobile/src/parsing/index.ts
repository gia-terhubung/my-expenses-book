import type { ReceiptAIAvailability } from "../../modules/receipt-ai/src/ReceiptAI.types";

import { AI_PARSING_ENABLED } from "./flags";
import { parseHeuristic } from "./heuristics";
import { mergeParsed, parseLlmOutput } from "./llm";
import type { ParsedReceipt } from "./types";

export const LLM_TIMEOUT_MS = 15_000;

export type ReceiptAILike = {
  getAvailability(): Promise<ReceiptAIAvailability>;
  parseReceipt(ocrText: string, hints: { locale: string; homeCurrency: string }): Promise<string>;
};

// Lazy: requireNativeModule throws where the module is absent (web, jest).
function nativeAi(): ReceiptAILike {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("../../modules/receipt-ai").default as ReceiptAILike;
}

export type ParseHints = { homeCurrency: string; locale: string; today: Date };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("LLM timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function parseReceipt(
  lines: string[],
  hints: ParseHints,
  ai?: ReceiptAILike,
  opts: { aiEnabled?: boolean; timeoutMs?: number } = {},
): Promise<ParsedReceipt> {
  const heur = parseHeuristic(lines, { homeCurrency: hints.homeCurrency, today: hints.today });
  if (!(opts.aiEnabled ?? AI_PARSING_ENABLED)) return heur;
  try {
    const engineAi = ai ?? nativeAi();
    const run = async () => {
      const avail = await engineAi.getAvailability();
      if (!avail.available || !avail.engine) return heur;
      const raw = await engineAi.parseReceipt(lines.join("\n"), {
        locale: hints.locale,
        homeCurrency: hints.homeCurrency,
      });
      return mergeParsed(heur, parseLlmOutput(raw, hints.homeCurrency, hints.today), avail.engine);
    };
    return await withTimeout(run(), opts.timeoutMs ?? LLM_TIMEOUT_MS);
  } catch {
    return heur;
  }
}
