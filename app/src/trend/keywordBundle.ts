import type { CompositionStyle, KeywordBundle } from './designSpecTypes';
import { KEYWORD_MAP, COMBO_RULES, type KeywordSignal } from './keywordMap';

export type { KeywordBundle } from './designSpecTypes';

/** The result of merging every keyword in a bundle's signals together —
 * ranked (highest-scoring first), not just a flat independent lookup per
 * keyword. `matchedTokens` and `comboNotes` are kept in the result so
 * callers (and tests) can see *why* a hint was picked, not just the final
 * pick. */
export interface ResolvedKeywordSignals {
  matchedTokens: string[];
  paletteHints: string[];
  motifHints: string[];
  styleDnaHints: string[];
  compositionHints: CompositionStyle[];
  moodHints: string[];
  comboNotes: string[];
}

const MULTI_WORD_KEYS = Object.keys(KEYWORD_MAP)
  .filter((k) => k.includes(' '))
  .sort((a, b) => b.length - a.length);

/** Splits a free-text keyword phrase into KEYWORD_MAP tokens it matches —
 * multi-word keys (e.g. "muted green") are checked before falling back to
 * single-word tokens, so "Muted Green" matches the dedicated combined
 * entry instead of just "muted" + "green" separately. */
function matchKeywordTokens(phrase: string): string[] {
  const lower = phrase.toLowerCase().trim();
  if (!lower) return [];
  const matched: string[] = [];
  let remaining = lower;
  for (const key of MULTI_WORD_KEYS) {
    if (remaining.includes(key)) {
      matched.push(key);
      remaining = remaining.replace(key, ' ');
    }
  }
  for (const word of remaining.split(/[\s,/-]+/).filter(Boolean)) {
    if (KEYWORD_MAP[word] && !matched.includes(word)) matched.push(word);
  }
  return matched;
}

function bump(map: Map<string, number>, value: string, amount: number): void {
  map.set(value, (map.get(value) ?? 0) + amount);
}

function rankedKeys(map: Map<string, number>): string[] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

/** Merges every keyword in the bundle (primary weighted 2x over
 * secondary, on top of each matched token's own KEYWORD_MAP weight) into
 * one ranked signal set, then layers in `COMBO_RULES` bonuses wherever two
 * matched tokens anywhere in the bundle form a known combination — the
 * "understand the relationship between keywords instead of treating them
 * independently" requirement. Deterministic and pure: no randomness, no
 * I/O, same input always produces the same ranking. */
export function resolveKeywordBundle(bundle: KeywordBundle): ResolvedKeywordSignals {
  const phrases: Array<{ text: string; weight: number }> = [
    { text: bundle.primaryKeyword, weight: 2 },
    ...bundle.secondaryKeywords.map((k) => ({ text: k, weight: 1 })),
  ];

  const paletteScores = new Map<string, number>();
  const motifScores = new Map<string, number>();
  const styleDnaScores = new Map<string, number>();
  const compositionScores = new Map<string, number>();
  const moodScores = new Map<string, number>();
  const matchedTokens = new Set<string>();

  for (const phrase of phrases) {
    for (const token of matchKeywordTokens(phrase.text)) {
      matchedTokens.add(token);
      const signal: KeywordSignal = KEYWORD_MAP[token];
      const effectiveWeight = phrase.weight * signal.weight;
      for (const v of signal.paletteHints) bump(paletteScores, v, effectiveWeight);
      for (const v of signal.motifHints) bump(motifScores, v, effectiveWeight);
      for (const v of signal.styleDnaHints) bump(styleDnaScores, v, effectiveWeight);
      for (const v of signal.compositionHints) bump(compositionScores, v, effectiveWeight);
      for (const v of signal.moodHints) bump(moodScores, v, effectiveWeight);
    }
  }

  const comboNotes: string[] = [];
  const comboWeight = 3; // stronger than any single-keyword contribution, so a matched combo reliably wins ties
  for (const rule of COMBO_RULES) {
    const [a, b] = rule.tokens;
    if (matchedTokens.has(a) && matchedTokens.has(b)) {
      comboNotes.push(rule.note);
      for (const v of rule.bonus.paletteHints ?? []) bump(paletteScores, v, comboWeight);
      for (const v of rule.bonus.motifHints ?? []) bump(motifScores, v, comboWeight);
      for (const v of rule.bonus.styleDnaHints ?? []) bump(styleDnaScores, v, comboWeight);
      for (const v of rule.bonus.compositionHints ?? []) bump(compositionScores, v, comboWeight);
      for (const v of rule.bonus.moodHints ?? []) bump(moodScores, v, comboWeight);
    }
  }

  return {
    matchedTokens: [...matchedTokens],
    paletteHints: rankedKeys(paletteScores),
    motifHints: rankedKeys(motifScores),
    styleDnaHints: rankedKeys(styleDnaScores),
    compositionHints: rankedKeys(compositionScores) as CompositionStyle[],
    moodHints: rankedKeys(moodScores),
    comboNotes,
  };
}
