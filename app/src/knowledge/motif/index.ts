import {
  listMotifGrammars,
  getMotifGrammar,
  findMotifGrammarsByFamily,
  findMotifGrammarsByPatternGrammar,
  isRoleAllowed,
} from '../../services/motifGrammarService';
import { listPatternGrammars } from '../../services/patternGrammarService';
import type { MotifGrammarData } from '../../motif-grammar';

// Design Knowledge Engine (Phase 6.5) — Section 3 "Motif Knowledge". A
// thin facade over `motif-grammar/*` + `services/motifGrammarService.ts`.
//
// Honest note on "forbidden combinations": this codebase has never stored
// a deny-list anywhere — `MotifGrammarData.compatiblePatternGrammars` is
// an *allow*-list (which Composition Styles this motif family composes
// well with). "Forbidden" is therefore a real, derived concept, not a
// separate stored list: a Pattern Grammar id NOT in a motif's
// `compatiblePatternGrammars` is forbidden for that motif. Recomputing it
// here (rather than a second static list) means it can never drift out of
// sync with the real allow-list data.

export function listMotifKnowledge(): MotifGrammarData[] {
  return listMotifGrammars();
}

export function getMotifKnowledge(id: string): MotifGrammarData | undefined {
  return getMotifGrammar(id);
}

export function findMotifKnowledgeByFamily(family: MotifGrammarData['family']): MotifGrammarData[] {
  return findMotifGrammarsByFamily(family);
}

export function findMotifKnowledgeByPatternGrammar(patternGrammarId: string): MotifGrammarData[] {
  return findMotifGrammarsByPatternGrammar(patternGrammarId);
}

export function isMotifRoleAllowed(motifId: string, role: MotifGrammarData['roles'][number]): boolean {
  return isRoleAllowed(motifId, role);
}

/** Real allow-list check: true when `patternGrammarId` is one of the
 * motif's own `compatiblePatternGrammars`. */
export function isCombinationRecommended(motifId: string, patternGrammarId: string): boolean {
  const grammar = getMotifGrammar(motifId);
  if (!grammar) return false;
  return grammar.compatiblePatternGrammars.includes(patternGrammarId);
}

/** Every real Pattern Grammar id NOT in the motif's own allow-list —
 * derived, not stored, so it can't drift from `compatiblePatternGrammars`.
 * Returns `[]` for an unknown motif id (nothing to forbid). */
export function getForbiddenPatternGrammars(motifId: string): string[] {
  const grammar = getMotifGrammar(motifId);
  if (!grammar) return [];
  const allPatternGrammarIds = listPatternGrammars().map((g) => g.id);
  return allPatternGrammarIds.filter((id) => !grammar.compatiblePatternGrammars.includes(id));
}

/** Every other motif in the same family — the real "recommended
 * combination" this codebase can honestly support (motifs that already
 * share a family are the ones the Motif Grammar Library groups as
 * compositionally related), not a fabricated pairing table. */
export function getRecommendedFamilyCombinations(motifId: string): MotifGrammarData[] {
  const grammar = getMotifGrammar(motifId);
  if (!grammar) return [];
  return listMotifGrammars().filter((g) => g.family === grammar.family && g.id !== grammar.id);
}
