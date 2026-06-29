import { combineTutorText, normalizeText } from "./normalizeText";

// Google Cloud TTS Chirp 3 HD is billed per character of input text.
// Default rate is configurable; adjust to your contracted price.
// USD per 1,000,000 characters (placeholder list price for HD voices).
export const CHIRP3HD_USD_PER_MILLION_CHARS = Number(
  process.env.CHIRP3HD_USD_PER_MILLION_CHARS || 30
);

export function countBillableChars(text: string): number {
  // Billing counts characters of the normalized input that will be sent to TTS.
  return Array.from(normalizeText(text)).length;
}

export function countTutorBillableChars(part1: string, part2?: string): number {
  return Array.from(combineTutorText(part1, part2)).length;
}

export function estimateCostUsd(totalChars: number): number {
  return (totalChars / 1_000_000) * CHIRP3HD_USD_PER_MILLION_CHARS;
}

export interface CostEstimate {
  totalTexts: number;
  totalChars: number;
  estimatedUsd: number;
}

export function summarizeCost(charsPerText: number[]): CostEstimate {
  const totalChars = charsPerText.reduce((sum, n) => sum + n, 0);
  return {
    totalTexts: charsPerText.length,
    totalChars,
    estimatedUsd: estimateCostUsd(totalChars),
  };
}
