import { describe, it, expect } from 'vitest';
import { listPatternGrammars } from '../../services/patternGrammarService';
import {
  listPatternKnowledge,
  getPatternKnowledge,
  findPatternKnowledgeByLayout,
  isPatternDensityCompatible,
  isPatternNegativeSpaceCompatible,
  getPatternCommercialSuitability,
} from './index';

describe('knowledge/pattern: pass-through lookups', () => {
  it('listPatternKnowledge / getPatternKnowledge match the real Pattern Grammar Library', () => {
    expect(listPatternKnowledge().length).toBe(listPatternGrammars().length);
    const grammar = listPatternGrammars()[0];
    expect(getPatternKnowledge(grammar.id)).toEqual(grammar);
  });

  it('findPatternKnowledgeByLayout returns only grammars that actually list that layout', () => {
    const grammar = listPatternGrammars().find((g) => g.compatibleLayouts.length > 0)!;
    const results = findPatternKnowledgeByLayout(grammar.compatibleLayouts[0]);
    expect(results.some((r) => r.id === grammar.id)).toBe(true);
  });

  it('density/negative-space compatibility checks honor the grammar\'s own real ranges', () => {
    const grammar = listPatternGrammars()[0];
    expect(isPatternDensityCompatible(grammar.id, grammar.densityRange.min)).toBe(true);
    expect(isPatternDensityCompatible(grammar.id, grammar.densityRange.min - 1)).toBe(false);
    expect(isPatternNegativeSpaceCompatible(grammar.id, grammar.negativeSpaceRange.max)).toBe(true);
  });
});

describe('knowledge/pattern: getPatternCommercialSuitability', () => {
  it('composes the real Product Targets recommender and returns all 10 named uses', () => {
    const results = getPatternCommercialSuitability({ categoryId: 'botanical', tileSize: 1400, density: 0.5 });
    expect(results.length).toBe(10);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it('is deterministic for the same input', () => {
    const input = { categoryId: 'geometric', tileSize: 1200, density: 0.4, keywordText: 'wallpaper' };
    expect(getPatternCommercialSuitability(input)).toEqual(getPatternCommercialSuitability(input));
  });
});
