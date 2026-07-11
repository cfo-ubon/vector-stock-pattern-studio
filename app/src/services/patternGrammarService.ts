import { PATTERN_GRAMMAR_DATA, PATTERN_GRAMMAR_DATA_BY_ID, type PatternGrammarData } from '../pattern-grammar';

// Thin query/lookup service over the Pattern Grammar Library.

export function listPatternGrammars(): PatternGrammarData[] {
  return PATTERN_GRAMMAR_DATA;
}

export function getPatternGrammar(id: string): PatternGrammarData | undefined {
  return PATTERN_GRAMMAR_DATA_BY_ID[id];
}

export function findPatternGrammarsByLayout(layoutId: string): PatternGrammarData[] {
  return PATTERN_GRAMMAR_DATA.filter((grammar) => grammar.compatibleLayouts.includes(layoutId));
}

/** True when `density` falls within the grammar's `densityRange`. Returns
 * false for an unknown grammar id rather than throwing. */
export function isDensityCompatible(patternGrammarId: string, density: number): boolean {
  const grammar = PATTERN_GRAMMAR_DATA_BY_ID[patternGrammarId];
  if (!grammar) return false;
  return density >= grammar.densityRange.min && density <= grammar.densityRange.max;
}

/** True when `negativeSpace` falls within the grammar's `negativeSpaceRange`. */
export function isNegativeSpaceCompatible(patternGrammarId: string, negativeSpace: number): boolean {
  const grammar = PATTERN_GRAMMAR_DATA_BY_ID[patternGrammarId];
  if (!grammar) return false;
  return negativeSpace >= grammar.negativeSpaceRange.min && negativeSpace <= grammar.negativeSpaceRange.max;
}
