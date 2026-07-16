import { listPatternGrammars, getPatternGrammar, findPatternGrammarsByLayout, isDensityCompatible, isNegativeSpaceCompatible } from '../../services/patternGrammarService';
import { evaluateProductTargets, type ProductUseEvaluation } from '../../collection/productTargets';
import type { PatternGrammarData } from '../../pattern-grammar';

// Design Knowledge Engine (Phase 6.5) — Section 5 "Pattern Knowledge". A
// thin facade over `pattern-grammar/*` + `services/patternGrammarService.ts`.
//
// Honest note on "Difficulty": no Pattern Grammar record has a difficulty
// field — `DifficultyId` ('simple'|'moderate'|'complex') lives on
// `trend/designSpecTypes.ts`'s `KeywordBundle`, a user/trend-level input
// to Design Intelligence, not a derived property of a Composition Style.
// Rather than fabricate a new per-pattern difficulty score with no real
// engine behind it, this module simply doesn't expose one — a Pattern
// Grammar's real, load-bearing constraints (density range, negative space
// range, compatible layouts/flow/rhythm) are exposed instead.
//
// "Commercial suitability" IS real, derived data: `getPatternCommercialSuitability`
// composes the existing Product Targets recommender
// (`collection/productTargets.ts`, Commercial Collection Engine Phase 4)
// against a concrete category/tile-size/density context, rather than
// inventing a second, disconnected suitability score.

export function listPatternKnowledge(): PatternGrammarData[] {
  return listPatternGrammars();
}

export function getPatternKnowledge(id: string): PatternGrammarData | undefined {
  return getPatternGrammar(id);
}

export function findPatternKnowledgeByLayout(layoutId: string): PatternGrammarData[] {
  return findPatternGrammarsByLayout(layoutId);
}

export function isPatternDensityCompatible(patternGrammarId: string, density: number): boolean {
  return isDensityCompatible(patternGrammarId, density);
}

export function isPatternNegativeSpaceCompatible(patternGrammarId: string, negativeSpace: number): boolean {
  return isNegativeSpaceCompatible(patternGrammarId, negativeSpace);
}

export interface PatternCommercialSuitabilityInput {
  categoryId: string;
  tileSize: number;
  density: number;
  keywordText?: string;
}

/** Real Product Targets evaluation (Commercial Collection Engine Phase 4)
 * for a concrete pattern context — not a static per-grammar property,
 * since commercial fit genuinely depends on category/size/density, not
 * the Composition Style alone. */
export function getPatternCommercialSuitability(input: PatternCommercialSuitabilityInput): ProductUseEvaluation[] {
  return evaluateProductTargets({
    categoryId: input.categoryId,
    tileSize: input.tileSize,
    density: input.density,
    keywordText: input.keywordText ?? '',
  });
}
