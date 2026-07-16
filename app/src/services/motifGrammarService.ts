import { MOTIF_GRAMMAR_DATA, MOTIF_GRAMMAR_DATA_BY_ID, type MotifGrammarData } from '../motif-grammar';

// Thin query/lookup service over the Motif Grammar Library.

export function listMotifGrammars(): MotifGrammarData[] {
  return MOTIF_GRAMMAR_DATA;
}

export function getMotifGrammar(id: string): MotifGrammarData | undefined {
  return MOTIF_GRAMMAR_DATA_BY_ID[id];
}

export function findMotifGrammarsByFamily(family: MotifGrammarData['family']): MotifGrammarData[] {
  return MOTIF_GRAMMAR_DATA.filter((grammar) => grammar.family === family);
}

export function findMotifGrammarsByPatternGrammar(patternGrammarId: string): MotifGrammarData[] {
  return MOTIF_GRAMMAR_DATA.filter((grammar) => grammar.compatiblePatternGrammars.includes(patternGrammarId));
}

/** True when the given category's Motif Grammar allows `role`. Returns
 * false for an unknown category id rather than throwing. */
export function isRoleAllowed(categoryId: string, role: MotifGrammarData['roles'][number]): boolean {
  const grammar = MOTIF_GRAMMAR_DATA_BY_ID[categoryId];
  if (!grammar) return false;
  return grammar.roles.includes(role);
}
