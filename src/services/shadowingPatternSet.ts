interface ShadowingPattern {
  en: string;
  zh: string;
}

export const DEFAULT_SHADOWING_PRACTICE_COUNT = 4;

export function isShadowablePattern(pattern: ShadowingPattern): boolean {
  return Boolean(pattern.en.trim()) && !/_{2,}/.test(pattern.en);
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function pickShadowingPatternSet(
  patterns: ShadowingPattern[],
  seed: string,
  count = DEFAULT_SHADOWING_PRACTICE_COUNT
): ShadowingPattern[] {
  const shadowable = patterns.filter(isShadowablePattern);
  if (shadowable.length <= count) return shadowable;

  const start = hashSeed(seed) % shadowable.length;
  return Array.from({ length: count }, (_, index) => shadowable[(start + index) % shadowable.length]);
}
